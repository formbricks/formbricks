import "server-only";

import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { ZId } from "@formbricks/types/v1/environment";
import { TIntegration } from "@formbricks/types/v1/integrations";
import { validateInputs } from "../utils/validate";
import { ZString, ZOptionalNumber } from "@formbricks/types/v1/common";
import { ITEMS_PER_PAGE } from "../constants";

export async function createOrUpdateIntegration(
  environmentId: string,
  integrationData: Pick<TIntegration, "type" | "config">
): Promise<TIntegration> {
  validateInputs([environmentId, ZId]);

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

export const getIntegrations = async (environmentId: string, page?: number): Promise<TIntegration[]> => {
  validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

  try {
    const result = await prisma.integration.findMany({
      where: {
        environmentId,
      },
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const getIntegration = async (integrationId: string): Promise<TIntegration | null> => {
  try {
    const result = await prisma.integration.findUnique({
      where: {
        id: integrationId,
      },
    });
    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }
    throw error;
  }
};

export const deleteIntegration = async (integrationId: string): Promise<TIntegration> => {
  validateInputs([integrationId, ZString]);

  try {
    const integrationData = await prisma.integration.delete({
      where: {
        id: integrationId,
      },
    });

    return integrationData;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
