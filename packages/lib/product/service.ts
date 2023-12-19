import "server-only";

import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { z } from "zod";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import type { TProduct, TProductUpdateInput } from "@formbricks/types/product";
import { ZProduct, ZProductUpdateInput } from "@formbricks/types/product";

import { IS_S3_CONFIGURED, ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { environmentCache } from "../environment/cache";
import { createEnvironment } from "../environment/service";
import { deleteLocalFilesByEnvironmentId, deleteS3FilesByEnvironmentId } from "../storage/service";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { productCache } from "./cache";

const selectProduct = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  teamId: true,
  brandColor: true,
  highlightBorderColor: true,
  recontactDays: true,
  linkSurveyBranding: true,
  inAppSurveyBranding: true,
  placement: true,
  clickOutsideClose: true,
  darkOverlay: true,
  environments: true,
  supportEmail: true,
};

export const getProducts = async (teamId: string, page?: number): Promise<TProduct[]> => {
  const products = await unstable_cache(
    async () => {
      validateInputs([teamId, ZId], [page, ZOptionalNumber]);

      try {
        const products = await prisma.product.findMany({
          where: {
            teamId,
          },
          select: selectProduct,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
        });
        return products;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getProducts-${teamId}-${page}`],
    {
      tags: [productCache.tag.byTeamId(teamId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return products.map((product) => formatDateFields(product, ZProduct));
};

export const getProductByEnvironmentId = async (environmentId: string): Promise<TProduct | null> => {
  const product = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

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
          console.error(error);
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getProductByEnvironmentId-${environmentId}`],
    {
      tags: [productCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return product ? formatDateFields(product, ZProduct) : null;
};

export const updateProduct = async (
  productId: string,
  inputProduct: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  validateInputs([productId, ZId], [inputProduct, ZProductUpdateInput.partial()]);

  const { environments, ...data } = inputProduct;
  let updatedProduct;
  try {
    updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data: {
        ...data,
        environments: {
          connect: environments?.map((environment) => ({ id: environment.id })) ?? [],
        },
      },
      select: selectProduct,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
  }

  try {
    const product = ZProduct.parse(updatedProduct);

    productCache.revalidate({
      id: product.id,
      teamId: product.teamId,
    });

    product.environments.forEach((environment) => {
      // revalidate environment cache
      productCache.revalidate({
        environmentId: environment.id,
      });
    });

    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
};

export const getProduct = async (productId: string): Promise<TProduct | null> => {
  const product = await unstable_cache(
    async () => {
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
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getProduct-${productId}`],
    {
      tags: [productCache.tag.byId(productId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return product ? formatDateFields(product, ZProduct) : null;
};

export const deleteProduct = async (productId: string): Promise<TProduct> => {
  const product = await prisma.product.delete({
    where: {
      id: productId,
    },
    select: selectProduct,
  });

  if (product) {
    // delete all files from storage related to this product

    if (IS_S3_CONFIGURED) {
      const s3FilesPromises = product.environments.map(async (environment) => {
        return deleteS3FilesByEnvironmentId(environment.id);
      });

      try {
        await Promise.all(s3FilesPromises);
      } catch (err) {
        // fail silently because we don't want to throw an error if the files are not deleted
        console.error(err);
      }
    } else {
      const localFilesPromises = product.environments.map(async (environment) => {
        return deleteLocalFilesByEnvironmentId(environment.id);
      });

      try {
        await Promise.all(localFilesPromises);
      } catch (err) {
        // fail silently because we don't want to throw an error if the files are not deleted
        console.error(err);
      }
    }

    productCache.revalidate({
      id: product.id,
      teamId: product.teamId,
    });

    environmentCache.revalidate({
      productId: product.id,
    });

    product.environments.forEach((environment) => {
      // revalidate product cache
      productCache.revalidate({
        environmentId: environment.id,
      });
      environmentCache.revalidate({
        id: environment.id,
      });
    });
  }

  return product;
};

export const createProduct = async (
  teamId: string,
  productInput: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  validateInputs([teamId, ZString], [productInput, ZProductUpdateInput.partial()]);

  if (!productInput.name) {
    throw new ValidationError("Product Name is required");
  }

  const { environments, ...data } = productInput;

  let product = await prisma.product.create({
    data: {
      ...data,
      name: productInput.name,
      teamId,
    },
    select: selectProduct,
  });

  const devEnvironment = await createEnvironment(product.id, {
    type: "development",
  });

  const prodEnvironment = await createEnvironment(product.id, {
    type: "production",
  });

  return await updateProduct(product.id, {
    environments: [devEnvironment, prodEnvironment],
  });
};
