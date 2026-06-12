import { logger } from "@formbricks/logger";
import { deleteWebhook, getWebhook } from "@/app/api/v1/webhooks/[webhookId]/lib/webhook";
import { removeSecretFromWebhook } from "@/app/api/v1/webhooks/lib/utils";
import { responses } from "@/app/lib/api/response";
import { THandlerParams, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";

export const GET = withV1ApiWrapper({
  handler: async ({ props, authentication }: THandlerParams<{ params: Promise<{ webhookId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;

    const webhook = await getWebhook(params.webhookId);
    if (!webhook) {
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
    if (!hasPermission(authentication.workspacePermissions, webhook.workspaceId, "GET")) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }
    return {
      response: responses.successResponse(removeSecretFromWebhook(webhook)),
    };
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: THandlerParams<{ params: Promise<{ webhookId: string }> }>) => {
    if (!authentication || !("apiKeyId" in authentication)) {
      return { response: responses.notAuthenticatedResponse() };
    }

    const params = await props.params;
    if (auditLog) {
      auditLog.targetId = params.webhookId;
    }

    // check if webhook exists
    const webhook = await getWebhook(params.webhookId);
    if (!webhook) {
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
    if (!hasPermission(authentication.workspacePermissions, webhook.workspaceId, "DELETE")) {
      return {
        response: responses.unauthorizedResponse(),
      };
    }

    if (auditLog) {
      auditLog.oldObject = webhook;
    }

    // delete webhook from database
    try {
      const deletedWebhook = await deleteWebhook(params.webhookId);
      return {
        response: responses.successResponse(removeSecretFromWebhook(deletedWebhook)),
      };
    } catch (e) {
      if (auditLog) {
        auditLog.status = "failure";
      }
      logger.error({ error: e, url: req.url }, "Error deleting webhook");
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
  },
  action: "deleted",
  targetType: "webhook",
});
