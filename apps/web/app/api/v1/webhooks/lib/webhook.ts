import { TWebhookInput, ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { cache } from "@/lib/cache";
import { webhookCache } from "@/lib/cache/webhook";
import { ITEMS_PER_PAGE } from "@/lib/constants";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma, Webhook } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId, ZOptionalNumber } from "@formbricks/types/common";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const createWebhook = async (webhookInput: TWebhookInput): Promise<Webhook> => {
  // [UseTusk]
  validateInputs([webhookInput, ZWebhookInput]);

  try {
    const createdWebhook = await prisma.webhook.create({
      data: {
        url: webhookInput.url,
        name: webhookInput.name,
        source: webhookInput.source,
        surveyIds: webhookInput.surveyIds || [],
        triggers: webhookInput.triggers || [],
        environment: {
          connect: {
            id: webhookInput.environmentId,
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(
        `Database error when creating webhook for environment ${webhookInput.environmentId}`
      );
    }

    throw error;
  }
};

export const getWebhooks = (environmentIds: string[], page?: number): Promise<Webhook[]> =>
  cache(
    async () => {
      validateInputs([environmentIds, ZId.array()], [page, ZOptionalNumber]);

      try {
        const webhooks = await prisma.webhook.findMany({
          where: {
            environmentId: { in: environmentIds },
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
    environmentIds.map((environmentId) => `getWebhooks-${environmentId}-${page}`),
    {
      tags: environmentIds.map((environmentId) => webhookCache.tag.byEnvironmentId(environmentId)),
    }
  )();
