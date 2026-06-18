/**
 * POST /api/v3/workflows/{workflowId}/duplicate — clone a workflow into a new draft.
 * Thin adapter delegating to the framework-agnostic handler in `@formbricks/workflows/server`.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "created",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ req, parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.duplicate({
      req,
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});
