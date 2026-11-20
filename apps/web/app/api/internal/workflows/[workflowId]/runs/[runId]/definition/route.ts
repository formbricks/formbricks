/**
 * GET /api/internal/workflows/{workflowId}/runs/{runId}/definition — the definition a run executed: its
 * version's for a live run, the saved draft for a Test run, or none. Read access. The Runs tab draws the
 * run on it.
 *
 * Internal (CODING_STANDARDS "API Design"): only the app calls it, so it is session-only, with no
 * OpenAPI entry and no stability promise.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { ZWorkflowRunDefinitionParams, getWorkflowRunDefinition } from "../../../../lib/run-definition";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkflowRunDefinitionParams },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    getWorkflowRunDefinition({ authentication, requestId, instance, params: parsedInput.params }),
});
