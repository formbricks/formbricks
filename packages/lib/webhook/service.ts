import "server-only";

import { TWebhook, TWebhookInput, ZWebhookInput } from "@formbricks/types/v1/webhooks";
import { prisma } from "@formbricks/database";
import { Prisma } from "@prisma/client";
import { validateInputs } from "../utils/validate";
import { ZId } from "@formbricks/types/v1/environment";
import { ResourceNotFoundError, DatabaseError, InvalidInputError } from "@formbricks/types/v1/errors";
import { ZOptionalNumber } from "@formbricks/types/v1/common";
import { ITEMS_PER_PAGE } from "../constants";

export const getWebhooks = async (environmentId: string, page?: number): Promise<TWebhook[]> => {
  validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        environmentId: environmentId,
      },
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });
    return webhooks;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
  }
};

export const getCountOfWebhooksBasedOnSource = async (
  environmentId: string,
  source: TWebhookInput["source"]
): Promise<number> => {
  validateInputs([environmentId, ZId], [source, ZId]);
  try {
    const count = await prisma.webhook.count({
      where: {
        environmentId,
        source,
      },
    });
    return count;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
  }
};

export const getWebhook = async (id: string): Promise<TWebhook | null> => {
  validateInputs([id, ZId]);
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
  validateInputs([environmentId, ZId], [webhookInput, ZWebhookInput]);
  try {
    let createdWebhook = await prisma.webhook.create({
      data: {
        ...webhookInput,
        surveyIds: webhookInput.surveyIds || [],
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });
    return createdWebhook;
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
  validateInputs([environmentId, ZId], [webhookId, ZId], [webhookInput, ZWebhookInput]);
  try {
    const webhook = await prisma.webhook.update({
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
    return webhook;
  } catch (error) {
    throw new DatabaseError(
      `Database error when updating webhook with ID ${webhookId} for environment ${environmentId}`
    );
  }
};

export const deleteWebhook = async (id: string): Promise<TWebhook> => {
  validateInputs([id, ZId]);
  try {
    let deletedWebhook = await prisma.webhook.delete({
      where: {
        id,
      },
    });
    return deletedWebhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};
