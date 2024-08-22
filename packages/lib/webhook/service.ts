import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TWebhook, TWebhookInput, ZWebhookInput } from "@formbricks/types/webhooks";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { webhookCache } from "./cache";

export const getWebhooks = (environmentId: string, page?: number): Promise<TWebhook[]> =>
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

export const getWebhookCountBySource = (
  environmentId: string,
  source: TWebhookInput["source"]
): Promise<number> =>
  cache(
    async () => {
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
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getWebhookCountBySource-${environmentId}-${source}`],
    {
      tags: [webhookCache.tag.byEnvironmentIdAndSource(environmentId, source)],
    }
  )();

export const getWebhook = async (id: string): Promise<TWebhook | null> =>
  cache(
    async () => {
      validateInputs([id, ZId]);

      try {
        const webhook = await prisma.webhook.findUnique({
          where: {
            id,
          },
        });
        return webhook;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getWebhook-${id}`],
    {
      tags: [webhookCache.tag.byId(id)],
    }
  )();

export const createWebhook = async (
  environmentId: string,
  webhookInput: TWebhookInput
): Promise<TWebhook> => {
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

    return createdWebhook;
  } catch (error) {
    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(`Database error when creating webhook for environment ${environmentId}`);
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const updateWebhook = async (
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<TWebhook> => {
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

    return updatedWebhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
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

    webhookCache.revalidate({
      id: deletedWebhook.id,
      environmentId: deletedWebhook.environmentId,
      source: deletedWebhook.source,
    });

    return deletedWebhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};
