/**
 * GET  /api/v3/webhooks — list a workspace's webhooks.
 * POST /api/v3/webhooks — create a webhook; the response carries its signing secret, once.
 *
 * Session cookie, API key or OAuth token. Agent-first (ADR 0015): everything the webhooks settings page did
 * is reachable here, with the same workspace access checks and the same SSRF policy as deliveries.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZV3WorkspaceListQuery } from "@/app/api/v3/lib/schemas";
import { createV3Webhook, listV3Webhooks } from "./lib/operations";
import { ZV3CreateWebhookBody } from "./lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3WorkspaceListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3Webhooks({
      workspaceId: parsedInput.query.workspaceId,
      limit: parsedInput.query.limit,
      cursor: parsedInput.query.cursor,
      authentication,
      requestId,
      instance,
    }),
});

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "webhook",
  schemas: { body: ZV3CreateWebhookBody },
  handler: async ({ authentication, parsedInput, auditLog, requestId, instance }) =>
    createV3Webhook({ authentication, body: parsedInput.body, auditLog, requestId, instance }),
});
