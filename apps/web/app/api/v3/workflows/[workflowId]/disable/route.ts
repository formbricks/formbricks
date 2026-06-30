/**
 * POST /api/v3/workflows/{workflowId}/disable — move an enabled workflow to disabled.
 * Thin adapter delegating to the framework-agnostic handler in @formbricks/workflows/server.
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
    workflowsHandlers.disable({
      ctx: buildWorkflowApiContext(authentication, requestId, instance, auditLog),
      params: parsedInput.params,
    }),
});
