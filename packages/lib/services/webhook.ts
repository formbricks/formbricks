import { TWebhook, TWebhookInput } from "@formbricks/types/v1/webhooks";
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { ResourceNotFoundError, DatabaseError, InvalidInputError } from "@formbricks/errors";

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
  try {
    const webhook = await prisma.webhook.findUnique({
      where: {
        id,
      },
    });
    if (!webhook) {
      throw new ResourceNotFoundError("Webhook", id);
    }
    return webhook;
  } catch (error) {
    if (!(error instanceof ResourceNotFoundError)) {
      throw new DatabaseError(`Database error when fetching webhook with ID ${id}`);
    }
    throw error;
  }
};

export const createWebhook = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
  try {
    if (!webhookInput.url || !webhookInput.trigger) {
      throw new InvalidInputError("Missing URL or trigger in webhook input");
    }
    return await prisma.webhook.create({
      data: {
        url: webhookInput.url,
        triggers: [webhookInput.trigger],
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
