import "server-only";
import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/errors";
import { _ZEnvironmentProduct } from "@formbricks/types/v1/product";
import { ZEnvironmentWithProduct } from "@formbricks/types/v1/environment";
import type { TEnvironmentProduct } from "@formbricks/types/v1/environment";

// const ZEnvironmentWithProduct = ZEnvironment.extend({
//   product: _ZEnvironmentProduct,
// });

// type TEnvironmentProduct = z.infer<typeof ZEnvironmentWithProduct>;

export const getEnvironment = async (environmentId: string): Promise<TEnvironmentProduct | null> => {
  let environmentPrisma;
  try {
    environmentPrisma = await prisma.environment.findUnique({
      where: {
        id: environmentId,
      },
      select: {
        id: true,
        createdAt: true,
        updatedAt: true,
        type: true,
        productId: true,
        widgetSetupCompleted: true,
        product: {
          select: {
            id: true,
            name: true,
            teamId: true,
            brandColor: true,
            environments: true,
          },
        },
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

  try {
    const environment = ZEnvironmentWithProduct.parse(environmentPrisma);
    return environment;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of environment failed");
  }
};
