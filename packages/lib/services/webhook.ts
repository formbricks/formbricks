"use server";
import "server-only";

import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { ResourceNotFoundError, DatabaseError, InvalidInputError } from "@formbricks/types/v1/errors";

export const getWebhooks = async (environmentId: string): Promise<TWebhook[]> => {
  try {
    return await prisma.webhook.findMany({
      where: {
        environmentId: environmentId,
      },
    });
  } catch (error) {
    throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
  }
};

export const getWebhook = async (id: string): Promise<TWebhook | null> => {
  const webhook = await prisma.webhook.findUnique({
    where: {
      id,
    },
  });
  return webhook;
};

export const createWebhook = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
  try {
    if (!webhookInput.url || !webhookInput.triggers) {
      throw new InvalidInputError("Missing URL or trigger in webhook input");
    }
    return await prisma.webhook.create({
      data: {
        name: webhookInput.name,
        url: webhookInput.url,
        triggers: webhookInput.triggers,
        surveyIds: webhookInput.surveyIds || [],
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });
  } catch (error) {
    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(`Database error when creating webhook for environment ${environmentId}`);
    }
    throw error;
  }
};

export const updateWebhook = async (
  environmentId: string,
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<TWebhook> => {
  try {
    const result = await prisma.webhook.update({
      where: {
        id: webhookId,
      },
      data: {
        name: webhookInput.name,
        url: webhookInput.url,
        triggers: webhookInput.triggers,
        surveyIds: webhookInput.surveyIds || [],
      },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(
      `Database error when updating webhook with ID ${webhookId} for environment ${environmentId}`
    );
  }
};

export const deleteWebhook = async (id: string): Promise<TWebhook> => {
  try {
    return await prisma.webhook.delete({
      where: {
        id,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};
