import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
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
import { cache } from "../cache";
import { membershipCache } from "../membership/cache";
import { organizationCache } from "../organization/cache";
import { getOrganizationsByUserId } from "../organization/service";
import { productCache } from "../product/cache";
import { getProducts } from "../product/service";
import { validateInputs } from "../utils/validate";
import { environmentCache } from "./cache";

export const getEnvironment = reactCache(
  (environmentId: string): Promise<TEnvironment | null> =>
    cache(
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
      }
    )()
);

export const getEnvironments = reactCache(
  (productId: string): Promise<TEnvironment[]> =>
    cache(
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
      }
    )()
);

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
  try {
    const organizations = await getOrganizationsByUserId(userId);
    if (organizations.length === 0) {
      throw new Error(`Unable to get first environment: User ${userId} has no organizations`);
    }
    const firstOrganization = organizations[0];
    const products = await getProducts(firstOrganization.id);
    if (products.length === 0) {
      throw new Error(
        `Unable to get first environment: Organization ${firstOrganization.id} has no products`
      );
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
  } catch (error) {
    throw error;
  }
};

export const getProductionEnvironmentIdsByUserId = async (userId: string): Promise<string[]> =>
  cache(
    async () => {
      validateInputs([userId, z.string()]);

      try {
        const memberships = await prisma.membership.findMany({
          where: {
            userId,
          },
          select: {
            organization: {
              select: {
                products: {
                  select: {
                    environments: {
                      where: {
                        type: "production",
                      },
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });

        // Extract environment IDs from the fetched memberships
        const environmentIds = memberships.flatMap((membership) =>
          membership.organization.products.flatMap((product) =>
            product.environments.map((environment) => environment.id)
          )
        );

        return environmentIds;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          console.error(error);
          throw new DatabaseError(error.message);
        }

        throw new Error("Error while fetching environment IDs");
      }
    },
    [`getProductionEnvironmentIdsByUserId-${userId}`],
    {
      tags: [
        membershipCache.tag.byUserId(userId),
        productCache.tag.byUserId(userId),
        organizationCache.tag.byUserId(userId),
      ],
    }
  )();

export const createEnvironment = async (
  productId: string,
  environmentInput: Partial<TEnvironmentCreateInput>
): Promise<TEnvironment> => {
  validateInputs([productId, ZId], [environmentInput, ZEnvironmentCreateInput]);

  try {
    const environment = await prisma.environment.create({
      data: {
        type: environmentInput.type || "development",
        product: { connect: { id: productId } },
        appSetupCompleted: environmentInput.appSetupCompleted || false,
        websiteSetupCompleted: environmentInput.websiteSetupCompleted || false,
        actionClasses: {
          create: [
            {
              name: "New Session",
              description: "Gets fired when a new session is created",
              type: "automatic",
            },
          ],
        },
        attributeClasses: {
          create: [
            // { name: "userId", description: "The internal ID of the person", type: "automatic" },
            { name: "email", description: "The email of the person", type: "automatic" },
            { name: "language", description: "The language used by the person", type: "automatic" },
          ],
        },
      },
    });

    environmentCache.revalidate({
      id: environment.id,
      productId: environment.productId,
    });

    return environment;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
