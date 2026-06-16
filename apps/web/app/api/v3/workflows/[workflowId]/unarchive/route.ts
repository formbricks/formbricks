/**
 * POST /api/v3/workflows/{workflowId}/unarchive — restore an archived workflow to draft.
 * Thin adapter delegating to the framework-agnostic handler in `@formbricks/workflows/server`.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const POST = withV3ApiWrapper({
  auth: "both",
  action: "updated",
  targetType: "workflow",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.unarchive(
      buildWorkflowApiContext(authentication, requestId, instance),
      parsedInput.params
    ),
});
