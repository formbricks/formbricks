import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { headers } from "next/headers";
import { getApiKeyFromKey } from "@formbricks/lib/apiKey/service";
import { createWebhook, getWebhooks } from "@formbricks/lib/webhook/service";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";
import { ZWebhookInput } from "@formbricks/types/webhooks";

export const GET = async () => {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await getApiKeyFromKey(apiKey);
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  // get webhooks from database
  try {
    const webhooks = await getWebhooks(apiKeyData.environmentId);
    return Response.json({ data: webhooks });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    return responses.internalServerErrorResponse(error.message);
  }
};

export const POST = async (request: Request) => {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await getApiKeyFromKey(apiKey);
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }
  const webhookInput = await request.json();
  const inputValidation = ZWebhookInput.safeParse(webhookInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // add webhook to database
  try {
    const webhook = await createWebhook(apiKeyData.environmentId, inputValidation.data);
    return responses.successResponse(webhook);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
    throw error;
  }
};
