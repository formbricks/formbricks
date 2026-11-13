import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteWebhookOperation, updateWebhookOperation } from "../lib/operations";
import { ZWebhookIdParams, ZWebhookUpdateBody } from "../schemas";

/** `PUT /api/internal/webhooks/{webhookId}`: replace the webhook's name, URL, triggers and surveys. */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWebhookIdParams, body: ZWebhookUpdateBody },
  action: "updated",
  targetType: "webhook",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateWebhookOperation({
      authentication,
      webhookId: parsedInput.params.webhookId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/webhooks/{webhookId}`: delete the webhook. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWebhookIdParams },
  action: "deleted",
  targetType: "webhook",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteWebhookOperation({
      authentication,
      webhookId: parsedInput.params.webhookId,
      requestId,
      instance,
      auditLog,
    }),
});
