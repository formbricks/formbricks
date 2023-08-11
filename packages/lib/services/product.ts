import "server-only";

import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/errors";
import { ZProduct } from "@formbricks/types/v1/product";
import type { TProduct } from "@formbricks/types/v1/product";
import { cache } from "react";

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

const updateProductService = async (
  productId: string,
  data: Prisma.ProductUpdateInput
): Promise<TProduct> => {
  try {
    const updatedProduct = await prisma.product.update({
      where: {
        id: productId,
      },
      data,
    });

    return updatedProduct;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2016") {
      throw new ResourceNotFoundError("Product", productId);
    } else {
      throw error; // Re-throw any other errors
    }
  }
};

export const updateProduct = cache(updateProductService);
