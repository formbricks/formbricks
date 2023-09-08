import "server-only";
import { prisma } from "@formbricks/database";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { DatabaseError, ResourceNotFoundError, ValidationError } from "@formbricks/errors";
import { ZEnvironment } from "@formbricks/types/v1/environment";
import type { TEnvironment } from "@formbricks/types/v1/environment";
import { cache } from "react";
import { Session } from "next-auth";
import { EnvironmentType } from "@prisma/client";
import { populateEnvironment } from "@/lib/populate";

export const getEnvironment = cache(async (environmentId: string): Promise<TEnvironment | null> => {
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

export const getEnvironmentBySession = cache(async (user: any): Promise<any> => {
  // find first production enviroment of the user
  const firstMembership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
    },
    select: {
      teamId: true,
    },
  });

  if (!firstMembership) {
    // create a new team and return environment
    const membership = await prisma.membership.create({
      data: {
        accepted: true,
        role: "owner",
        user: { connect: { id: user.id } },
        team: {
          create: {
            name: `${user.name}'s Team`,
            products: {
              create: {
                name: "My Product",
                environments: {
                  create: [
                    {
                      type: EnvironmentType.production,
                      ...populateEnvironment,
                    },
                    {
                      type: EnvironmentType.development,
                      ...populateEnvironment,
                    },
                  ],
                },
              },
            },
          },
        },
      },
      include: {
        team: {
          include: {
            products: {
              include: {
                environments: true,
              },
            },
          },
        },
      },
    });

    const environment = membership.team.products[0].environments[0];
    console.log(environment);
    return environment;
    // return res.status(404).json({ message: "No memberships found" });
  }

  const firstProduct = await prisma.product.findFirst({
    where: {
      teamId: firstMembership.teamId,
    },
    select: {
      id: true,
    },
  });
  if (firstProduct === null) {
    return null;
  }
  const firstEnvironment = await prisma.environment.findFirst({
    where: {
      productId: firstProduct.id,
      type: "production",
    },
    select: {
      id: true,
    },
  });
  if (firstEnvironment === null) {
    return null;
  }
  console.log(firstEnvironment);
  return firstEnvironment;
});
