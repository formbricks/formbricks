/**
 * /api/v3/workflows/runs/{runId} — retrieve a single workflow run with its ordered step logs.
 * Unknown / cross-workspace run ids return 403 (not 404) to avoid leaking existence.
 *
 * Thin adapter: the wrapper validates the path param with the contract schema, then delegates to
 * the framework-agnostic handler in `@formbricks/workflows/server`.
 */
import { ZWorkflowRunIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { buildWorkflowApiContext, workflowsHandlers } from "../../lib/context";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZWorkflowRunIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    workflowsHandlers.getRun({
      ctx: buildWorkflowApiContext(authentication, requestId, instance),
      params: parsedInput.params,
    }),
});
