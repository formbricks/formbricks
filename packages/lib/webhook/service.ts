import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import "server-only";

import { prisma } from "@formbricks/database";
import { ZOptionalNumber } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TWebhook, TWebhookInput, ZWebhook, ZWebhookInput } from "@formbricks/types/webhooks";

import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { formatDateFields } from "../utils/datetime";
import { validateInputs } from "../utils/validate";
import { webhookCache } from "./cache";

export const getWebhooks = async (environmentId: string, page?: number): Promise<TWebhook[]> => {
  const webhooks = await unstable_cache(
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
        throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
      }
    },
    [`getWebhooks-${environmentId}-${page}`],
    {
      tags: [webhookCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return webhooks.map((webhook) => formatDateFields(webhook, ZWebhook));
};

export const getWebhookCountBySource = async (
  environmentId: string,
  source: TWebhookInput["source"]
): Promise<number> =>
  unstable_cache(
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
        throw new DatabaseError(`Database error when fetching webhooks for environment ${environmentId}`);
      }
    },
    [`getCountOfWebhooksBasedOnSource-${environmentId}-${source}`],
    {
      tags: [webhookCache.tag.byEnvironmentIdAndSource(environmentId, source)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getWebhook = async (id: string): Promise<TWebhook | null> => {
  const webhook = await unstable_cache(
    async () => {
      validateInputs([id, ZId]);

      const webhook = await prisma.webhook.findUnique({
        where: {
          id,
        },
      });
      return webhook;
    },
    [`getWebhook-${id}`],
    {
      tags: [webhookCache.tag.byId(id)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return webhook ? formatDateFields(webhook, ZWebhook) : null;
};

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
