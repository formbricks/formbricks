/**
 * POST /api/v3/workflows/{workflowId}/webhook/regenerate — replace the Webhook Secret URL; the old one
 * answers 404 from the next call on. Audited as `webhookUrlRegenerated`. Thin adapter delegating to
 * @formbricks/workflows/server.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../../lib/context";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "webhookUrlRegenerated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    workflowsHandlers.regenerateWebhook({
      ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
      params: parsedInput.params,
    }),
});
