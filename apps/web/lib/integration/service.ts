import "server-only";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId, ZOptionalNumber, ZString } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import {
  TIntegration,
  TIntegrationByType,
  TIntegrationInput,
  ZIntegrationType,
} from "@formbricks/types/integration";
import { withStoredIntegrationKey } from "@/lib/integration/redact-credentials";
import { assertNewlyAttachedSurveysWorkspaceVisible } from "@/lib/survey/visibility/outbound";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";

const getIntegrationSurveyIds = (config: unknown): string[] => {
  const data = (config as { data?: unknown } | null | undefined)?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((entry) =>
    typeof (entry as { surveyId?: unknown })?.surveyId === "string"
      ? [(entry as { surveyId: string }).surveyId]
      : []
  );
};

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

type TIntegrationWriter = Pick<Prisma.TransactionClient, "integration">;

/** Writes the integration, refusing a newly mapped survey the workspace can't see (ENG-3283). */
const writeIntegration = async (
  client: TIntegrationWriter,
  workspaceId: string,
  integrationData: TIntegrationInput,
  storedConfig: unknown
): Promise<TIntegration> => {
  // An integration row forwards its surveys' responses to a third party, so a newly mapped survey must
  // be workspace-visible. Surveys already mapped are left alone (dispatch skips a restricted one), so
  // token refreshes and unrelated edits keep saving.
  await assertNewlyAttachedSurveysWorkspaceVisible(
    getIntegrationSurveyIds(integrationData.config),
    getIntegrationSurveyIds(storedConfig)
  );

  try {
    return await client.integration.upsert({
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error(error, "Error creating or updating integration");
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};

export const createOrUpdateIntegration = async (
  workspaceId: string,
  integrationData: TIntegrationInput
): Promise<TIntegration> => {
  validateInputs([workspaceId, ZId]);

  const existing = await prisma.integration.findUnique({
    where: { type_workspaceId: { workspaceId, type: integrationData.type } },
    select: { config: true },
  });
  return writeIntegration(prisma, workspaceId, integrationData, existing?.config);
};

/**
 * Saves an integration from the settings UI. The UI only ever holds redacted credentials, so the
 * `config.key` it sends is replaced with the stored one (see {@link withStoredIntegrationKey}):
 * credentials are written only by the OAuth callbacks and token refreshes, which call
 * {@link createOrUpdateIntegration} directly.
 *
 * The stored key is read under the row's lock, in the transaction that writes it back (ENG-2123). Read
 * before the write, a refresh committing in between was overwritten with the key read before it, and the
 * integration lost its new credentials. A writer that reaches the row first now makes this wait, and this
 * reads what it committed; one that comes second waits for this save, then writes its key over it.
 */
export const saveIntegrationKeepingStoredKey = async (
  workspaceId: string,
  integrationData: TIntegrationInput
): Promise<TIntegration> => {
  validateInputs([workspaceId, ZId], [integrationData.type, ZIntegrationType]);

  return prisma.$transaction(async (tx) => {
    // No row means nothing to keep: the first connect, which only the OAuth callbacks perform.
    await tx.$queryRaw`
      SELECT 1 FROM "Integration"
      WHERE "workspaceId" = ${workspaceId} AND "type" = ${integrationData.type}::"IntegrationType"
      FOR UPDATE
    `;
    const stored = await tx.integration.findUnique({
      where: { type_workspaceId: { workspaceId, type: integrationData.type } },
      select: { config: true },
    });
    return writeIntegration(
      tx,
      workspaceId,
      withStoredIntegrationKey(integrationData, stored),
      stored?.config
    );
  });
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
