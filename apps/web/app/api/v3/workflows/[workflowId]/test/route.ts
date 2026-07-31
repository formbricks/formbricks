/**
 * POST /api/v3/workflows/{workflowId}/test — dry-run (test) a workflow: validate that its live
 * definition would execute and that the trigger's referenced survey + ending cards resolve.
 * No run is created and no side effects occur; the response reports `{ ok, problems }`. Thin
 * adapter delegating to @formbricks/workflows/server.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.testWorkflow({
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});
