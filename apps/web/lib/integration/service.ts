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
import { loggableError } from "@/lib/utils/loggable-error";
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

/** Maps a Prisma failure to the service's `DatabaseError`; anything else is rethrown as is. */
const toDatabaseError = (error: unknown): unknown => {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    logger.error(loggableError(error), "Error creating or updating integration");
    return new DatabaseError(error.message);
  }
  return error;
};

/**
 * Refuses a write that maps a survey the workspace can't see (ENG-3283): an
 * integration row forwards its surveys' responses to a third party, so a newly mapped survey must be
 * workspace-visible. Surveys already mapped are left alone (dispatch skips a restricted one), so token
 * refreshes and unrelated edits keep saving.
 */
const assertMappedSurveysVisible = (
  integrationData: TIntegrationInput,
  storedConfig: unknown,
  client: Pick<Prisma.TransactionClient, "survey"> = prisma
) =>
  assertNewlyAttachedSurveysWorkspaceVisible(
    getIntegrationSurveyIds(integrationData.config),
    getIntegrationSurveyIds(storedConfig),
    client
  );

const integrationWrite = (workspaceId: string, integrationData: TIntegrationInput) => ({
  ...integrationData,
  workspace: { connect: { id: workspaceId } },
});

export const createOrUpdateIntegration = async (
  workspaceId: string,
  integrationData: TIntegrationInput
): Promise<TIntegration> => {
  validateInputs([workspaceId, ZId]);

  const existing = await prisma.integration.findUnique({
    where: { type_workspaceId: { workspaceId, type: integrationData.type } },
    select: { config: true },
  });
  await assertMappedSurveysVisible(integrationData, existing?.config);

  try {
    return await prisma.integration.upsert({
      where: { type_workspaceId: { workspaceId, type: integrationData.type } },
      update: integrationWrite(workspaceId, integrationData),
      create: integrationWrite(workspaceId, integrationData),
    });
  } catch (error) {
    throw toDatabaseError(error);
  }
};

/**
 * Saves an integration from the settings UI. The UI only ever holds redacted credentials, so the
 * `config.key` it sends is replaced with the stored one (see {@link withStoredIntegrationKey}):
 * credentials are written only by the OAuth callbacks and token refreshes, which call
 * {@link createOrUpdateIntegration} directly.
 *
 * The stored key is read under the row's lock, in the transaction that writes it back (ENG-2123). Read
 * before the write, a refresh committing in between was overwritten with the key read before it, and the
 * integration lost its new credentials. Now a writer holding the row makes this save wait, and the save
 * then reads the key that writer committed. A writer that reaches the row after the save waits for it to
 * commit before writing its own update.
 *
 * With no stored row there is nothing to lock or keep, so the save only creates one: a callback that
 * inserts the row meanwhile makes it fail on the unique key rather than be overwritten with the
 * client's key.
 */
export const saveIntegrationKeepingStoredKey = async (
  workspaceId: string,
  integrationData: TIntegrationInput
): Promise<TIntegration> => {
  validateInputs([workspaceId, ZId], [integrationData.type, ZIntegrationType]);
  const where = { type_workspaceId: { workspaceId, type: integrationData.type } };

  try {
    return await prisma.$transaction(async (tx) => {
      // The config comes from the locking read itself: a later read is a new snapshot, which could see a
      // row a callback inserted after this lock found none, unlocked.
      const [stored] = await tx.$queryRaw<{ config: TIntegration["config"] }[]>`
        SELECT "config" FROM "Integration"
        WHERE "workspaceId" = ${workspaceId} AND "type" = ${integrationData.type}::"IntegrationType"
        FOR UPDATE
      `;
      const merged = withStoredIntegrationKey(integrationData, stored);
      await assertMappedSurveysVisible(merged, stored?.config, tx);

      return stored
        ? tx.integration.update({ where, data: integrationWrite(workspaceId, merged) })
        : tx.integration.create({ data: integrationWrite(workspaceId, merged) });
    });
  } catch (error) {
    throw toDatabaseError(error);
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
