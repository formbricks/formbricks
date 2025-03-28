import { authenticateRequest } from "@/app/api/v1/auth";
import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { DatabaseError, InvalidInputError } from "@formbricks/types/errors";

export const GET = async (request: Request) => {
  const authentication = await authenticateRequest(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const environmentIds = authentication.environmentPermissions.map(
      (permission) => permission.environmentId
    );
    const webhooks = await getWebhooks(environmentIds);
    return responses.successResponse(webhooks);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
    throw error;
  }
};

export const POST = async (request: Request) => {
  const authentication = await authenticateRequest(request);
  if (!authentication) {
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

  const environmentId = inputValidation.data.environmentId;

  if (!environmentId) {
    return responses.badRequestResponse("Environment ID is required");
  }

  if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
    return responses.unauthorizedResponse();
  }

  // add webhook to database
  try {
    const webhook = await createWebhook(inputValidation.data);
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
