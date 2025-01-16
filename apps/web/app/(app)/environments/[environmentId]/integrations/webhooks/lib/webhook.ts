import { webhookCache } from "@/lib/cache/webhook";
import { Prisma, Webhook } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { ITEMS_PER_PAGE } from "@formbricks/lib/constants";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { TWebhookInput, ZWebhookInput } from "../types/webhooks";

export const updateWebhook = async (
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<boolean> => {
  validateInputs([webhookId, ZId], [webhookInput, ZWebhookInput]);
  try {
    const updatedWebhook = await prisma.webhook.update({
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

    webhookCache.revalidate({
      id: updatedWebhook.id,
      environmentId: updatedWebhook.environmentId,
      source: updatedWebhook.source,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteWebhook = async (id: string): Promise<boolean> => {
  validateInputs([id, ZId]);

  try {
    let deletedWebhook = await prisma.webhook.delete({
      where: {
        id,
      },
    });

    webhookCache.revalidate({
      id: deletedWebhook.id,
      environmentId: deletedWebhook.environmentId,
      source: deletedWebhook.source,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};

export const createWebhook = async (environmentId: string, webhookInput: TWebhookInput): Promise<boolean> => {
  validateInputs([environmentId, ZId], [webhookInput, ZWebhookInput]);

  try {
    const createdWebhook = await prisma.webhook.create({
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

    webhookCache.revalidate({
      id: createdWebhook.id,
      environmentId: createdWebhook.environmentId,
      source: createdWebhook.source,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(`Database error when creating webhook for environment ${environmentId}`);
    }

    throw error;
  }
};

export const getWebhooks = (environmentId: string, page?: number): Promise<Webhook[]> =>
  cache(
    async () => {
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
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getWebhooks-${environmentId}-${page}`],
    {
      tags: [webhookCache.tag.byEnvironmentId(environmentId)],
    }
  )();

export const testEndpoint = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        event: "testEndpoint",
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      return true;
    } else {
      const errorMessage = await response.text();
      throw new UnknownError(`Request failed with status code ${statusCode}: ${errorMessage}`);
    }
  } catch (error) {
    throw new UnknownError(`Error while fetching the URL: ${error.message}`);
  }
};
