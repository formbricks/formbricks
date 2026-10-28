import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma, type Webhook } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { generateWebhookSecret } from "@/lib/crypto";
import type { TWebhookWithoutSecret } from "../serializers";
import type { TV3CreateWebhookBody, TV3UpdateWebhookBody } from "./schemas";

/**
 * Data access for the v3 webhook operations. Every read and write names the workspace, so a webhook id
 * on its own never reaches a row in another tenant, and every read omits the signing secret: the only
 * path that selects it is `getWebhookDeliveryTarget`, and the only response that carries it is create's.
 *
 * Authorization, URL validation and survey checks belong to the operation, not here.
 */

const withoutSecret = { secret: true } as const;

const isRecordNotFound = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === PrismaErrorType.RecordNotFound;

/** Looks a webhook up by id alone, to learn which workspace to authorize against. */
export const findWebhookById = (webhookId: string): Promise<TWebhookWithoutSecret | null> =>
  prisma.webhook.findUnique({ where: { id: webhookId }, omit: withoutSecret });

/** A workspace's webhooks, oldest id first. A workspace holds a handful, so the caller pages in memory. */
export const listWorkspaceWebhooks = (workspaceId: string): Promise<TWebhookWithoutSecret[]> =>
  prisma.webhook.findMany({ where: { workspaceId }, orderBy: { id: "asc" }, omit: withoutSecret });

/** The ids of `surveyIds` that are surveys of `workspaceId`. A survey of another workspace is absent. */
export const findWorkspaceSurveyIds = async (
  workspaceId: string,
  surveyIds: ReadonlyArray<string>
): Promise<Set<string>> => {
  if (surveyIds.length === 0) return new Set();

  const rows = await prisma.survey.findMany({
    where: { workspaceId, id: { in: [...surveyIds] } },
    select: { id: true },
  });
  return new Set(rows.map(({ id }) => id));
};

/** Creates the webhook with a server-generated secret and returns the row including it, once. */
export const createWorkspaceWebhook = async (
  workspaceId: string,
  input: TV3CreateWebhookBody
): Promise<Webhook> => {
  try {
    return await prisma.webhook.create({
      data: {
        name: input.name,
        url: input.url,
        source: input.source,
        triggers: [...new Set(input.triggers)],
        surveyIds: [...new Set(input.surveyIds)],
        secret: generateWebhookSecret(),
        workspace: { connect: { id: workspaceId } },
      },
    });
  } catch (error) {
    throw new DatabaseError(
      error instanceof Prisma.PrismaClientKnownRequestError
        ? error.message
        : `Database error when creating webhook for workspace ${workspaceId}`
    );
  }
};

/** Applies only the fields that are present; an absent one keeps its stored value. */
export const updateWorkspaceWebhook = async (
  workspaceId: string,
  webhookId: string,
  input: TV3UpdateWebhookBody
): Promise<TWebhookWithoutSecret> => {
  try {
    return await prisma.webhook.update({
      where: { id: webhookId, workspaceId },
      data: {
        name: input.name,
        url: input.url,
        triggers: input.triggers && [...new Set(input.triggers)],
        surveyIds: input.surveyIds && [...new Set(input.surveyIds)],
      },
      omit: withoutSecret,
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new ResourceNotFoundError("Webhook", webhookId);
    throw error instanceof Prisma.PrismaClientKnownRequestError ? new DatabaseError(error.message) : error;
  }
};

export const deleteWorkspaceWebhook = async (
  workspaceId: string,
  webhookId: string
): Promise<TWebhookWithoutSecret> => {
  try {
    return await prisma.webhook.delete({
      where: { id: webhookId, workspaceId },
      omit: withoutSecret,
    });
  } catch (error) {
    if (isRecordNotFound(error)) throw new ResourceNotFoundError("Webhook", webhookId);
    throw new DatabaseError(`Database error when deleting webhook with ID ${webhookId}`);
  }
};

/** What a test delivery needs: the stored URL and secret. Never put the result in a response or a log. */
export const getWebhookDeliveryTarget = (
  workspaceId: string,
  webhookId: string
): Promise<Pick<Webhook, "url" | "secret"> | null> =>
  prisma.webhook.findFirst({
    where: { id: webhookId, workspaceId },
    select: { url: true, secret: true },
  });
