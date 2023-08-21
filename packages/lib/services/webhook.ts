"use server";
import "server-only";

import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { ResourceNotFoundError, DatabaseError, InvalidInputError } from "@formbricks/errors";

export const getWebhooks = async (environmentId: string): Promise<TWebhook[]> => {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        environmentId: environmentId,
      },
    });
    return webhooks.map((webhook) => ({
      ...webhook,
      source: webhook.source as "user" | "zapier" | null | undefined,
    }));
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
  if (webhook) {
    return {
      ...webhook,
      source: webhook.source as "user" | "zapier" | null | undefined,
    };
  }
  return null;
};

export const createWebhook = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
  try {
    if (!webhookInput.url || !webhookInput.triggers || !webhookInput.source) {
      throw new InvalidInputError("Missing URL, trigger, or source in webhook input");
    }
    if (webhookInput.source !== "user" && webhookInput.source !== "zapier") {
      throw new InvalidInputError("Invalid source in webhook input");
    }

    let createdWebhook = await prisma.webhook.create({
      data: {
        name: webhookInput.name,
        url: webhookInput.url,
        source: webhookInput.source,
        triggers: webhookInput.triggers,
        surveyIds: webhookInput.surveyIds || [],
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });
    return {
      ...createdWebhook,
      source: createdWebhook.source as "user" | "zapier" | null | undefined,
    };
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
    return {
      ...result,
      source: result.source as "user" | "zapier" | null | undefined,
    };
  } catch (error) {
    throw new DatabaseError(
      `Database error when updating webhook with ID ${webhookId} for environment ${environmentId}`
    );
  }
};

export const deleteWebhook = async (id: string): Promise<TWebhook> => {
  try {
    let deletedWebhook = await prisma.webhook.delete({
      where: {
        id,
      },
    });
    return {
      ...deletedWebhook,
      source: deletedWebhook.source as "user" | "zapier" | null | undefined,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};
