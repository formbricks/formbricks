import { authenticateRequest } from "@/app/api/v1/auth";
import { createWebhook, getWebhooks } from "@/app/api/v1/webhooks/lib/webhook";
import { ZWebhookInput } from "@/app/api/v1/webhooks/types/webhooks";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
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

export const POST = withApiLogging(async (request: Request) => {
  const auditLog: ApiAuditLog = {
    actionType: "webhook.created",
    targetType: "webhook",
    userId: "unknown",
    targetId: undefined,
    organizationId: "unknown",
    status: "failure",
    newObject: undefined,
  };

  const authentication = await authenticateRequest(request);
  if (!authentication) {
    return {
      response: responses.notAuthenticatedResponse(),
      audit: auditLog,
    };
  }

  auditLog.organizationId = authentication.organizationId;
  auditLog.userId = authentication.apiKeyId;
  const webhookInput = await request.json();
  const inputValidation = ZWebhookInput.safeParse(webhookInput);

  if (!inputValidation.success) {
    return {
      response: responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      ),
      audit: auditLog,
    };
  }

  const environmentId = inputValidation.data.environmentId;
  if (!environmentId) {
    return {
      response: responses.badRequestResponse("Environment ID is required"),
      audit: auditLog,
    };
  }

  if (!hasPermission(authentication.environmentPermissions, environmentId, "POST")) {
    return {
      response: responses.unauthorizedResponse(),
      audit: auditLog,
    };
  }

  try {
    const webhook = await createWebhook(inputValidation.data);
    auditLog.targetId = webhook.id;
    auditLog.status = "success";
    auditLog.newObject = webhook;
    return {
      response: responses.successResponse(webhook),
      audit: auditLog,
    };
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return {
        response: responses.badRequestResponse(error.message),
        audit: auditLog,
      };
    }
    if (error instanceof DatabaseError) {
      return {
        response: responses.internalServerErrorResponse(error.message),
        audit: auditLog,
      };
    }
    throw error;
  }
});
