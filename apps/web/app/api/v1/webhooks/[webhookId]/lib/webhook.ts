import { webhookCache } from "@/lib/cache/webhook";
import { Prisma, Webhook } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const deleteWebhook = async (id: string): Promise<Webhook> => {
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.RelatedRecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};

export const getWebhook = async (id: string): Promise<Webhook | null> =>
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
