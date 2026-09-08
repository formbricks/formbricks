import { v7 as uuidv7 } from "uuid";
import { prisma } from "@formbricks/database";
import { Prisma, Webhook } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { generateWebhookSecret } from "@/lib/crypto";
import { validateInputs } from "@/lib/utils/validate";
import { validateWebhookUrl } from "@/lib/utils/validate-webhook-url";
import { getTranslate } from "@/lingodotdev/server";
import {
  WebhookDeliveryTimeoutError,
  sendSignedWebhookRequest,
} from "@/modules/integrations/webhooks/lib/send-signed-webhook";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import { TWebhookInput } from "../types/webhooks";

const getWebhookTestErrorMessage = async (statusCode: number): Promise<string | null> => {
  switch (statusCode) {
    case 500: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_internal_server_error");
    }
    case 404: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_not_found_error");
    }
    case 405: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_method_not_allowed_error");
    }
    case 502: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_bad_gateway_error");
    }
    case 503: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_service_unavailable_error");
    }
    case 504: {
      const t = await getTranslate();
      return t("workspace.integrations.webhooks.endpoint_gateway_timeout_error");
    }
    default:
      return null;
  }
};

export const updateWebhook = async (
  webhookId: string,
  webhookInput: Partial<TWebhookInput>
): Promise<boolean> => {
  if (webhookInput.url) {
    await validateWebhookUrl(webhookInput.url);
  }

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
      error.code === PrismaErrorType.RecordNotFound
    ) {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};

export const createWebhook = async (
  workspaceId: string,
  webhookInput: TWebhookInput,
  secret?: string
): Promise<Webhook> => {
  await validateWebhookUrl(webhookInput.url);

  try {
    if (isDiscordWebhook(webhookInput.url)) {
      throw new UnknownError("Discord webhooks are currently not supported.");
    }

    const signingSecret = secret ?? generateWebhookSecret();

    const webhook = await prisma.webhook.create({
      data: {
        ...webhookInput,
        surveyIds: webhookInput.surveyIds || [],
        secret: signingSecret,
        workspace: {
          connect: {
            id: workspaceId,
          },
        },
      },
    });

    return webhook;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    if (!(error instanceof InvalidInputError)) {
      throw new DatabaseError(`Database error when creating webhook for workspace ${workspaceId}`);
    }

    throw error;
  }
};

export const getWebhooks = async (workspaceId: string): Promise<Webhook[]> => {
  validateInputs([workspaceId, ZId]);

  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        workspaceId,
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

export const testEndpoint = async (url: string, secret?: string): Promise<boolean> => {
  if (isDiscordWebhook(url)) {
    throw new UnknownError("Discord webhooks are currently not supported.");
  }

  try {
    // Same transport as real deliveries (SSRF validation, DNS pinning, signing, redirect policy,
    // timeout), so what the button proves is what the background worker will do.
    const { statusCode } = await sendSignedWebhookRequest({
      url,
      secret,
      body: JSON.stringify({ event: "testEndpoint" }),
      messageId: uuidv7(),
    });

    // With `redirect: "manual"` undici returns the actual 30x. Surface it as a clear error instead of
    // a misleading success; with `redirect: "follow"` (internal URLs allowed) this branch is unreachable.
    if (statusCode >= 300 && statusCode < 400) {
      throw new InvalidInputError("Webhook endpoint returned a redirect, which is not allowed");
    }

    const errorMessage = await getWebhookTestErrorMessage(statusCode);

    if (errorMessage) {
      throw new InvalidInputError(errorMessage);
    }

    return true;
  } catch (error) {
    if (error instanceof WebhookDeliveryTimeoutError) {
      throw new UnknownError(`Request timed out after ${Math.round(error.timeoutMs / 1000)} seconds`);
    }

    if (error instanceof InvalidInputError || error instanceof UnknownError) {
      throw error;
    }

    throw new UnknownError(
      `Error while fetching the URL: ${error instanceof Error ? error.message : "Unknown error occurred"}`
    );
  }
};
