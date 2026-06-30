import { prisma } from "@formbricks/database";
import { Prisma, Webhook } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const deleteWebhook = async (id: string): Promise<Omit<Webhook, "secret">> => {
  validateInputs([id, ZId]);

  try {
    let deletedWebhook = await prisma.webhook.delete({
      where: {
        id,
      },
      omit: {
        secret: true,
      },
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

export const getWebhook = async (id: string): Promise<Omit<Webhook, "secret"> | null> => {
  validateInputs([id, ZId]);

  try {
    const webhook = await prisma.webhook.findUnique({
      where: {
        id,
      },
      omit: {
        secret: true,
      },
    });
    return webhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
