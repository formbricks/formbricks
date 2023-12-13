import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import "server-only";
import "server-only";
import { z } from "zod";

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

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { getProducts } from "../product/service";
import { getTeamsByUserId } from "../team/service";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { environmentCache } from "./cache";

export const getEnvironment = async (environmentId: string): Promise<TEnvironment | null> => {
  const environment = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId]);

      try {
        const environment = await prisma.environment.findUnique({
          where: {
            id: environmentId,
          },
        });
        return environment;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getEnvironment-${environmentId}`],
    {
      tags: [environmentCache.tag.byId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return environment ? formatDateFields(environment, ZEnvironment) : null;
};

export const getEnvironments = async (productId: string): Promise<TEnvironment[]> => {
  const environments = await unstable_cache(
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
  return environments.map((environment) => formatDateFields(environment, ZEnvironment));
};

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
  const teams = await getTeamsByUserId(userId);
  if (teams.length === 0) {
    throw new Error(`Unable to get first environment: User ${userId} has no teams`);
  }
  const firstTeam = teams[0];
  const products = await getProducts(firstTeam.id);
  if (products.length === 0) {
    throw new Error(`Unable to get first environment: Team ${firstTeam.id} has no products`);
  }
  const firstProduct = products[0];
  const productionEnvironment = firstProduct.environments.find(
    (environment) => environment.type === "production"
  );
  if (!productionEnvironment) {
    throw new Error(
      `Unable to get first environment: Product ${firstProduct.id} has no production environment`
    );
  }
  return productionEnvironment;
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
      actionClasses: {
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
