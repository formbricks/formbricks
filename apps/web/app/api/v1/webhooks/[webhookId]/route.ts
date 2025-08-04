import { deleteWebhook, getWebhook } from "@/app/api/v1/webhooks/[webhookId]/lib/webhook";
import { responses } from "@/app/lib/api/response";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";

export const GET = withV1ApiWrapper(
  async (
    _request: Request,
    props: { params: Promise<{ webhookId: string }> },
    _auditLog: TApiAuditLog,
    authentication: TApiKeyAuthentication
  ) => {
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

    const params = await props.params;

    // add webhook to database
    const webhook = await getWebhook(params.webhookId);
    if (!webhook) {
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
    if (!hasPermission(authentication.environmentPermissions, webhook.environmentId, "GET")) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }
    return {
      response: responses.successResponse(webhook),
    };
  }
);

export const DELETE = withV1ApiWrapper(
  async (
    request: Request,
    props: { params: Promise<{ webhookId: string }> },
    auditLog: TApiAuditLog,
    authentication: TApiKeyAuthentication
  ) => {
    const params = await props.params;
    auditLog.targetId = params.webhookId;
    if (!authentication) {
      return {
        response: responses.notAuthenticatedResponse(),
      };
    }

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
