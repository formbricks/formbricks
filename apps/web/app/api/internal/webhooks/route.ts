import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createWebhookOperation } from "./lib/operations";
import { ZWebhookCreateBody, ZWebhookWorkspaceQuery } from "./schemas";

/** `POST /api/internal/webhooks?workspaceId=`: create a webhook in the workspace. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZWebhookWorkspaceQuery, body: ZWebhookCreateBody },
  action: "created",
  targetType: "webhook",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createWebhookOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
