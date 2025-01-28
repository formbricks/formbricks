import { getEnvironmentIdFromApiKey } from "@/app/api/v1/lib/api-key";
import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { headers } from "next/headers";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const GET = async () => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const environmentId = await getEnvironmentIdFromApiKey(apiKey);
  if (!environmentId) {
    return responses.notAuthenticatedResponse();
  }

  // get webhooks from database
  try {
    const webhooks = await getWebhooks(environmentId);
    return Response.json({ data: webhooks });
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    return responses.internalServerErrorResponse(error.message);
  }
};

export const POST = async (request: Request) => {
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const environmentId = await getEnvironmentIdFromApiKey(apiKey);
  if (!environmentId) {
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
    const webhook = await createWebhook(environmentId, inputValidation.data);
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
