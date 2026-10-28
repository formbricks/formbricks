/**
 * GET    /api/v3/webhooks/{webhookId} — read one webhook (never its secret).
 * PATCH  /api/v3/webhooks/{webhookId} — change its name, URL, triggers or surveys.
 * DELETE /api/v3/webhooks/{webhookId} — delete it.
 *
 * The workspace is resolved from the webhook, never from the request, so the caller cannot supply the scope
 * it is authorized against.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteV3Webhook, getV3Webhook, updateV3Webhook } from "../lib/operations";
import { ZV3UpdateWebhookBody, ZV3WebhookIdParams } from "../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3WebhookIdParams },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3Webhook({ authentication, webhookId: parsedInput.params.webhookId, requestId, instance }),
});

export const PATCH = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "webhook",
  schemas: { params: ZV3WebhookIdParams, body: ZV3UpdateWebhookBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    updateV3Webhook({
      authentication,
      webhookId: parsedInput.params.webhookId,
      body: parsedInput.body,
      auditLog,
      requestId,
      instance,
    }),
});

export const DELETE = withV3ApiWrapper({
  auth: "both",
  action: "deleted",
  targetType: "webhook",
  schemas: { params: ZV3WebhookIdParams },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    deleteV3Webhook({
      authentication,
      webhookId: parsedInput.params.webhookId,
      auditLog,
      requestId,
      instance,
    }),
});
