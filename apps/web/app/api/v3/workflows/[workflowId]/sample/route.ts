/**
 * PUT /api/v3/workflows/{workflowId}/sample — replace the Webhook trigger's Sample payload and return
 * the Variables it offers. Written beside the workflow, so `updatedAt` does not move (ADR 0048). Audited
 * as `updated` on the workflow, without the payload. Thin adapter delegating to @formbricks/workflows/server.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const PUT = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ req, parsedInput, authentication, auditLog, requestId, instance }) =>
    workflowsHandlers.setSample({
      req,
      ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
      params: parsedInput.params,
    }),
});
