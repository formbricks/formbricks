import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ValidationError } from "@formbricks/types/v1/errors";
import type { TProduct, TProductUpdateInput } from "@formbricks/types/v1/product";
import { ZProduct, ZProductUpdateInput } from "@formbricks/types/v1/product";
import { Prisma } from "@prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import "server-only";
import { z } from "zod";
import { validateInputs } from "../utils/validate";

const getProductCacheTag = (environmentId: string): string => `env-${environmentId}-product`;
const getProductCacheKey = (environmentId: string): string[] => [getProductCacheTag(environmentId)];

const selectProduct = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  teamId: true,
  brandColor: true,
  highlightBorderColor: true,
  recontactDays: true,
  formbricksSignature: true,
  placement: true,
  clickOutsideClose: true,
  darkOverlay: true,
  environments: true,
};

export const getProducts = cache(async (teamId: string): Promise<TProduct[]> => {
  validateInputs([teamId, ZId]);
  try {
    const products = await prisma.product.findMany({
      where: {
        teamId,
      },
      select: selectProduct,
    });

    return products;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});

export const getProductByEnvironmentId = cache(async (environmentId: string): Promise<TProduct | null> => {
  if (!environmentId) {
    throw new ValidationError("EnvironmentId is required");
  }
  let productPrisma;

  try {
    productPrisma = await prisma.product.findFirst({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
      select: selectProduct,
    });

    return productPrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
});

export const getProductByEnvironmentIdCached = (environmentId: string) =>
  unstable_cache(
    async () => {
      return await getProductByEnvironmentId(environmentId);
    },
    getProductCacheKey(environmentId),
    {
      tags: getProductCacheKey(environmentId),
      revalidate: 30 * 60, // 30 minutes
    }
  )();

export const updateProduct = async (
  productId: string,
  inputProduct: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  validateInputs([productId, ZId], [inputProduct, ZProductUpdateInput.partial()]);
  let updatedProduct;
  try {
    updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        ...inputProduct,
      },
      select: selectProduct,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
  }

  try {
    const product = ZProduct.parse(updatedProduct);

    product.environments.forEach((environment) => {
      // revalidate environment cache
      revalidateTag(getProductCacheTag(environment.id));
    });

    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
};

export const getProduct = cache(async (productId: string): Promise<TProduct | null> => {
  let productPrisma;
  try {
    productPrisma = await prisma.product.findUnique({
      where: {
        id: productId,
      },
      select: selectProduct,
    });

    return productPrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
});

export const deleteProduct = cache(async (productId: string): Promise<TProduct> => {
  const product = await prisma.product.delete({
    where: {
      id: productId,
    },
    select: selectProduct,
  });

  if (product) {
    product.environments.forEach((environment) => {
      // revalidate product cache
      revalidateTag(getProductCacheTag(environment.id));
    });
  }

  return product;
});
