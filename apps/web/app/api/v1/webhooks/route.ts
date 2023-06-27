import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { DatabaseError, InvalidInputError } from "@formbricks/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { createWebhook, getWebhooks } from "@formbricks/lib/services/webhook";
import { ZWebhookInput } from "@formbricks/types/v1/webhooks";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
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
    return NextResponse.json({ data: webhooks });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}

export async function POST(request: Request) {
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
}
