import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import {
  TIntegration,
  TIntegrationByType,
  TIntegrationInput,
  ZIntegrationType,
} from "@formbricks/types/integration";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

const transformIntegration = (integration: TIntegration): TIntegration => {
  return {
    ...integration,
    config: {
      ...integration.config,
      data: integration.config.data.map((data) => ({
        ...data,
        createdAt: new Date(data.createdAt),
      })),
    },
  } as TIntegration;
};

export const createOrUpdateIntegration = async (
  workspaceId: string,
  integrationData: TIntegrationInput
): Promise<TIntegration> => {
  validateInputs([workspaceId, ZId]);

  try {
    const integration = await prisma.integration.upsert({
      where: {
        type_workspaceId: {
          workspaceId,
          type: integrationData.type,
        },
      },
      update: {
        ...integrationData,
        workspace: { connect: { id: workspaceId } },
      },
      create: {
        ...integrationData,
        workspace: { connect: { id: workspaceId } },
      },
    });
    return integration;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating or updating integration");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const getIntegrations = reactCache(
  async (workspaceId: string, page?: number): Promise<TIntegration[]> => {
    validateInputs([workspaceId, ZId], [page, ZOptionalNumber]);

    try {
      const integrations = await prisma.integration.findMany({
        where: {
          workspaceId,
        },
        take: page ? ITEMS_PER_PAGE : undefined,
        skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
      });
      return integrations.map((integration) => transformIntegration(integration));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

export const getIntegration = reactCache(async (integrationId: string): Promise<TIntegration | null> => {
  try {
    const integration = await prisma.integration.findUnique({
      where: {
        id: integrationId,
      },
    });
    return integration ? transformIntegration(integration) : null;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
});

export const getIntegrationByType = reactCache(
  async <T extends TIntegrationInput["type"]>(
    workspaceId: string,
    type: T
  ): Promise<TIntegrationByType<T> | null> => {
    validateInputs([workspaceId, ZId], [type, ZIntegrationType]);

    try {
      const integration = await prisma.integration.findFirst({
        where: {
          workspaceId,
          type,
        },
      });
      return integration ? (transformIntegration(integration) as TIntegrationByType<T>) : null;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        throw new DatabaseError(error.message);
      }
      throw error;
    }
  }
);

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
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
