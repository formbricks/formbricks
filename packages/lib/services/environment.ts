import "server-only";
import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/errors";
import { ZEnvironment } from "@formbricks/types/v1/environment";
import type { TEnvironment, TEnvironmentUpdateInput } from "@formbricks/types/v1/environment";
import { cache } from "react";

export const getEnvironment = cache(async (environmentId: string): Promise<TEnvironment> => {
  let environmentPrisma;
  try {
    environmentPrisma = await prisma.environment.findUnique({
      where: {
        id: environmentId,
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
    const environment = ZEnvironment.parse(environmentPrisma);
    return environment;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of environment failed");
  }
});

export const getEnvironments = cache(async (productId: string): Promise<TEnvironment[]> => {
  let productPrisma;
  try {
    productPrisma = await prisma.product.findFirst({
      where: {
        id: productId,
      },
      include: {
        environments: true,
      },
    });

    if (!productPrisma) {
      throw new ResourceNotFoundError("Product", productId);
    }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }

  const environments: TEnvironment[] = [];
  for (let environment of productPrisma.environments) {
    let targetEnvironment: TEnvironment = ZEnvironment.parse(environment);
    environments.push(targetEnvironment);
  }

  try {
    return environments;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(JSON.stringify(error.errors, null, 2));
    }
    throw new ValidationError("Data validation of environments array failed");
  }
});

export const updateEnvironment = async (
  environmentId: string,
  data: Partial<TEnvironmentUpdateInput>
): Promise<TEnvironment> => {
  const newData = { ...data, updatedAt: new Date() };
  let updatedEnvironment;
  try {
    updatedEnvironment = await prisma.environment.update({
      where: {
        id: environmentId,
      },
      data: newData,
    });
    return updatedEnvironment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};
