import { Prisma, Webhook } from "@prisma/client";
import { v7 as uuidv7 } from "uuid";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { ZId } from "@formbricks/types/common";
import {
  DatabaseError,
  InvalidInputError,
  ResourceNotFoundError,
  UnknownError,
} from "@formbricks/types/errors";
import { DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS } from "@/lib/constants";
import { generateStandardWebhookSignature, generateWebhookSecret } from "@/lib/crypto";
import { validateInputs } from "@/lib/utils/validate";
import {
  createPinnedDispatcher,
  validateAndResolveWebhookUrl,
  validateWebhookUrl,
} from "@/lib/utils/validate-webhook-url";
import { getTranslate } from "@/lingodotdev/server";
import { isDiscordWebhook } from "@/modules/integrations/webhooks/lib/utils";
import { TWebhookInput } from "../types/webhooks";

const getWebhookTestErrorMessage = async (statusCode: number): Promise<string | null> => {
  switch (statusCode) {
    case 500: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_internal_server_error");
    }
    case 404: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_not_found_error");
    }
    case 405: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_method_not_allowed_error");
    }
    case 502: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_bad_gateway_error");
    }
    case 503: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_service_unavailable_error");
    }
    case 504: {
      const t = await getTranslate();
      return t("environments.integrations.webhooks.endpoint_gateway_timeout_error");
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
      error.code === PrismaErrorType.RelatedRecordDoesNotExist
    ) {
      throw new ResourceNotFoundError("Webhook", id);
    }
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};

export const createWebhook = async (
  environmentId: string,
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
        environment: {
          connect: {
            id: environmentId,
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

export const testEndpoint = async (url: string, secret?: string): Promise<boolean> => {
  const address = await validateAndResolveWebhookUrl(url);

  if (isDiscordWebhook(url)) {
    throw new UnknownError("Discord webhooks are currently not supported.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  // Hoisted out of the try so the finally can close it on every path.
  // Pin TCP connect to the validated IP — closes DNS-rebinding TOCTOU between
  // validation and fetch (undici otherwise resolves the hostname a second time).
  const dispatcher = address ? createPinnedDispatcher(address) : undefined;

  try {
    const webhookMessageId = uuidv7();
    const webhookTimestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ event: "testEndpoint" });

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "webhook-id": webhookMessageId,
      "webhook-timestamp": webhookTimestamp.toString(),
    };

    if (secret) {
      requestHeaders["webhook-signature"] = generateStandardWebhookSignature(
        webhookMessageId,
        webhookTimestamp,
        body,
        secret
      );
    }

    // `redirect: "manual"` prevents SSRF via redirect — validateWebhookUrl only checks the
    // initial URL, so following 30x to a private/internal host (e.g. cloud metadata) would bypass it.
    // Gated on the same env var as validateWebhookUrl: self-hosters who opted into trusting internal
    // URLs also get the pre-patch redirect-follow behavior for consistency.
    const redirectMode: RequestRedirect = DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS ? "follow" : "manual";
    const response = await fetch(url, {
      method: "POST",
      body,
      headers: requestHeaders,
      signal: controller.signal,
      redirect: redirectMode,
      dispatcher,
    } as RequestInit & { dispatcher?: ReturnType<typeof createPinnedDispatcher> });

    const statusCode = response.status;

    // With `redirect: "manual"`, Node's undici returns the actual 30x response (not the spec's
    // opaqueredirect filter). Treat any 30x as a redirect rejection so users get a clear error
    // instead of a misleading success. With `redirect: "follow"`, fetch returns the final 2xx/4xx/5xx
    // and this branch is unreachable.
    if (statusCode >= 300 && statusCode < 400) {
      throw new InvalidInputError("Webhook endpoint returned a redirect, which is not allowed");
    }

    const errorMessage = await getWebhookTestErrorMessage(statusCode);

    if (errorMessage) {
      throw new InvalidInputError(errorMessage);
    }

    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new UnknownError("Request timed out after 5 seconds");
    }

    if (error instanceof InvalidInputError || error instanceof UnknownError) {
      throw error;
    }

    throw new UnknownError(
      `Error while fetching the URL: ${error instanceof Error ? error.message : "Unknown error occurred"}`
    );
  } finally {
    clearTimeout(timeout);
    // destroy() — not close() — force-kills sockets. close() drains gracefully and
    // would deadlock if the endpoint accepted TCP but never responded (controller.abort()
    // above cancels fetch, but destroy is the belt-and-suspenders cleanup).
    await dispatcher?.destroy();
  }
};
