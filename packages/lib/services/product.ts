import "server-only";

import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/errors";
import { ZProductWithEnvironment } from "@formbricks/types/v1/product";
import type { TProductWithEnvironmentIds } from "@formbricks/types/v1/product";

export const getProductByEnvironmentId = async (
  environmentId: string
): Promise<TProductWithEnvironmentIds> => {
  let environmentPrisma;
  try {
    environmentPrisma = await prisma?.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        productId: true,
      },
    });

    if (!environmentPrisma) {
      throw new ResourceNotFoundError("Environment", environmentId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }

  let productPrisma;
  try {
    productPrisma = await prisma.product.findUnique({
      where: {
        id: environmentPrisma.productId,
      },
      include: {
        environments: {
          select: {
            id: true,
            type: true,
          },
        },
      },
    });

    if (!productPrisma) {
      throw new ResourceNotFoundError("Product", environmentPrisma.productId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }

  try {
    const product = ZProductWithEnvironment.parse(productPrisma);
    return product;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of product failed");
  }
};
