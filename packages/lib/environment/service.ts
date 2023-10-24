import "server-only";

import { prisma } from "@formbricks/database";
import type {
  TEnvironment,
  TEnvironmentCreateInput,
  TEnvironmentUpdateInput,
} from "@formbricks/types/environment";
import {
  ZEnvironment,
  ZEnvironmentCreateInput,
  ZEnvironmentUpdateInput,
  ZId,
} from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/types/errors";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import "server-only";
import { z } from "zod";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { validateInputs } from "../utils/validate";
import { environmentCache } from "./cache";
import { formatEnvironmentDateFields } from "./util";

export const getEnvironment = (environmentId: string) =>
  unstable_cache(
    async (): Promise<TEnvironment> => {
      validateInputs([environmentId, ZId]);
      let environmentPrisma;

      try {
        environmentPrisma = await prisma.environment.findUnique({
          where: {
            id: environmentId,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error.message);
          throw new DatabaseError(error.message);
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
    },
    [`getEnvironment-${environmentId}`],
    {
      tags: [environmentCache.tag.byId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getEnvironments = async (productId: string): Promise<TEnvironment[]> =>
  unstable_cache(
    async (): Promise<TEnvironment[]> => {
      validateInputs([productId, ZId]);
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
          throw new DatabaseError(error.message);
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
    },
    [`getEnvironments-${productId}`],
    {
      tags: [environmentCache.tag.byProductId(productId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const updateEnvironment = async (
  environmentId: string,
  data: Partial<TEnvironmentUpdateInput>
): Promise<TEnvironment> => {
  validateInputs([environmentId, ZId], [data, ZEnvironmentUpdateInput.partial()]);
  const newData = { ...data, updatedAt: new Date() };
  let updatedEnvironment;
  try {
    updatedEnvironment = await prisma.environment.update({
      where: {
        id: environmentId,
      },
      data: newData,
    });

    environmentCache.revalidate({
      id: environmentId,
      productId: updatedEnvironment.productId,
    });

    return updatedEnvironment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getFirstEnvironmentByUserId = async (userId: string): Promise<TEnvironment | null> => {
  const environment = await unstable_cache(
    async () => {
      validateInputs([userId, ZId]);
      try {
        return await prisma.environment.findFirst({
          where: {
            type: "production",
            product: {
              team: {
                memberships: {
                  some: {
                    userId,
                  },
                },
              },
            },
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getFirstEnvironmentByUserId-${userId}`],
    {
      tags: [environmentCache.tag.byUserId(userId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

  return environment ? formatEnvironmentDateFields(environment) : environment;
};

export const createEnvironment = async (
  productId: string,
  environmentInput: Partial<TEnvironmentCreateInput>
): Promise<TEnvironment> => {
  validateInputs([productId, ZId], [environmentInput, ZEnvironmentCreateInput]);

  const environment = await prisma.environment.create({
    data: {
      type: environmentInput.type || "development",
      product: { connect: { id: productId } },
      widgetSetupCompleted: environmentInput.widgetSetupCompleted || false,
      eventClasses: {
        create: [
          {
            name: "New Session",
            description: "Gets fired when a new session is created",
            type: "automatic",
          },
          {
            name: "Exit Intent (Desktop)",
            description: "A user on Desktop leaves the website with the cursor.",
            type: "automatic",
          },
          {
            name: "50% Scroll",
            description: "A user scrolled 50% of the current page",
            type: "automatic",
          },
        ],
      },
      attributeClasses: {
        create: [
          { name: "userId", description: "The internal ID of the person", type: "automatic" },
          { name: "email", description: "The email of the person", type: "automatic" },
        ],
      },
    },
  });

  environmentCache.revalidate({
    id: environment.id,
    productId: environment.productId,
  });

  return environment;
};
