import { authenticateRequest } from "@/app/api/v1/auth";
import { deleteWebhook, getWebhook } from "@/app/api/v1/webhooks/[webhookId]/lib/webhook";
import { responses } from "@/app/lib/api/response";
import { ApiAuditLog, withApiLogging } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { headers } from "next/headers";
import { logger } from "@formbricks/logger";

export const GET = async (request: Request, props: { params: Promise<{ webhookId: string }> }) => {
  const params = await props.params;
  const headersList = await headers();
  const apiKey = headersList.get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const authentication = await authenticateRequest(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }

  // add webhook to database
  const webhook = await getWebhook(params.webhookId);
  if (!webhook) {
    return responses.notFoundResponse("Webhook", params.webhookId);
  }
  if (!hasPermission(authentication.environmentPermissions, webhook.environmentId, "GET")) {
    return responses.unauthorizedResponse();
  }
  return responses.successResponse(webhook);
};

export const DELETE = withApiLogging(
  async (request: Request, props: { params: Promise<{ webhookId: string }> }, auditLog: ApiAuditLog) => {
    const params = await props.params;
    auditLog.targetId = params.webhookId;
    const headersList = headers();
    const apiKey = headersList.get("x-api-key");
    if (!apiKey) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }
    const authentication = await authenticateRequest(request);
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }
    auditLog.userId = authentication.apiKeyId;
    auditLog.organizationId = authentication.organizationId;
    // check if webhook exists
    const webhook = await getWebhook(params.webhookId);
    if (!webhook) {
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
    if (!hasPermission(authentication.environmentPermissions, webhook.environmentId, "DELETE")) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    auditLog.oldObject = webhook;

    // delete webhook from database
    try {
      const deletedWebhook = await deleteWebhook(params.webhookId);
      return {
        response: responses.successResponse(deletedWebhook),
      };
    } catch (e) {
      auditLog.status = "failure";
      logger.error({ error: e, url: request.url }, "Error deleting webhook");
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
  },
  "deleted",
  "webhook"
);
