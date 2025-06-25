import { validateInputs } from "@/lib/utils/validate";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import { Prisma, Webhook } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { TWebhookInput } from "../types/webhooks";

export const updateWebhook = async (
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<boolean> => {
  try {
    await prisma.webhook.update({
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

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const deleteWebhook = async (id: string): Promise<boolean> => {
  try {
    await prisma.webhook.delete({
      where: {
        id,
      },
    });

    return true;
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

export const createWebhook = async (environmentId: string, webhookInput: TWebhookInput): Promise<boolean> => {
  try {
    if (isDiscordWebhook(webhookInput.url)) {
      throw new UnknownError("Discord webhooks are currently not supported.");
    }
    await prisma.webhook.create({
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

export const getWebhooks = async (environmentId: string): Promise<Webhook[]> => {
  validateInputs([environmentId, ZId]);

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        environmentId: environmentId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return webhooks;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

export const testEndpoint = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    if (isDiscordWebhook(url)) {
      throw new UnknownError("Discord webhooks are currently not supported.");
    }

    const response = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        event: "testEndpoint",
      }),
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      return true;
    } else {
      const errorMessage = await response.text().then(
        (text) => text.substring(0, 1000) // Limit error message size
      );
      throw new UnknownError(`Request failed with status code ${statusCode}: ${errorMessage}`);
    }
  } catch (error) {
    if (error.name === "AbortError") {
      throw new UnknownError("Request timed out after 5 seconds");
    }
    if (error instanceof UnknownError) {
      throw error;
    }

    throw new UnknownError(`Error while fetching the URL: ${error.message}`);
  }
};
