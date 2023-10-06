import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { TIntegration } from "@formbricks/types/v1/integrations";
import { cache } from "react";

export async function createOrUpdateIntegration(
  environmentId: string,
  integrationData: any
): Promise<TIntegration> {
  try {
    const integration = await prisma.integration.upsert({
      where: {
        type_environmentId: {
          environmentId,
          type: integrationData.type,
        },
      },
      update: {
        ...integrationData,
        environment: { connect: { id: environmentId } },
      },
      create: {
        ...integrationData,
        environment: { connect: { id: environmentId } },
      },
    });
    return integration;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error(error);
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
}

export const getIntegrations = cache(async (environmentId: string): Promise<TIntegration[]> => {
  try {
    const result = await prisma.integration.findMany({
      where: {
        environmentId,
      },
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
});

export const deleteIntegration = async (integrationId: string): Promise<void> => {
  try {
    await prisma.integration.delete({
      where: {
        id: integrationId,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
