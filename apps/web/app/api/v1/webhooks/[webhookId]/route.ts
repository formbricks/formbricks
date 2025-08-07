import { deleteWebhook, getWebhook } from "@/app/api/v1/webhooks/[webhookId]/lib/webhook";
import { responses } from "@/app/lib/api/response";
import { TApiAuditLog, TApiKeyAuthentication, withV1ApiWrapper } from "@/app/lib/api/with-api-logging";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { NextRequest } from "next/server";
import { logger } from "@formbricks/logger";

export const GET = withV1ApiWrapper({
  handler: async ({
    props,
    authentication,
  }: {
    props: { params: Promise<{ webhookId: string }> };
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;

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
  },
});

export const DELETE = withV1ApiWrapper({
  handler: async ({
    req,
    props,
    auditLog,
    authentication,
  }: {
    req: NextRequest;
    props: { params: Promise<{ webhookId: string }> };
    auditLog: TApiAuditLog;
    authentication: NonNullable<TApiKeyAuthentication>;
  }) => {
    const params = await props.params;
    auditLog.targetId = params.webhookId;

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
      logger.error({ error: e, url: req.url }, "Error deleting webhook");
      return {
        response: responses.notFoundResponse("Webhook", params.webhookId),
      };
    }
  },
  action: "deleted",
  targetType: "webhook",
});
