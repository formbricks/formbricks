/**
 * /api/v3/workflows/{workflowId} — retrieve a single workflow.
 * Unknown / cross-workspace ids return 403 (not 404) to avoid leaking existence.
 *
 * Thin adapter: the wrapper validates the path param with the contract schema, then delegates to
 * the framework-agnostic handler in `@formbricks/workflows/server`.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.get(buildWorkflowApiContext(authentication, requestId, instance), parsedInput.params),
});
