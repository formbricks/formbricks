/**
 * POST /api/v3/workflows/{workflowId}/enable — validate executability, snapshot an immutable
 * version, and move the workflow to enabled. Thin adapter delegating to @formbricks/workflows/server.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, auditLog, requestId, instance }) =>
    workflowsHandlers.enable({
      ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
      params: parsedInput.params,
    }),
});
