import "server-only";
import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ZProduct, ZProductUpdateInput } from "@formbricks/types/v1/product";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/v1/errors";
import type { TProduct, TProductUpdateInput } from "@formbricks/types/v1/product";
import { cache } from "react";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";

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
};

export const getProductByEnvironmentId = cache(async (environmentId: string): Promise<TProduct> => {
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

    if (!productPrisma) {
      throw new ResourceNotFoundError("Product for Environment", environmentId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }

  try {
    const product = ZProduct.parse(productPrisma);
    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
});

export const updateProduct = async (
  productId: string,
  inputProduct: Partial<TProductUpdateInput>
): Promise<TProduct> => {
  validateInputs([productId, ZId], [inputProduct, ZProductUpdateInput]);
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
    throw error;
  }
  try {
    const product = ZProduct.parse(updatedProduct);
    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
};
