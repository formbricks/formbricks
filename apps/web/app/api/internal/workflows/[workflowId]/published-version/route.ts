/**
 * GET /api/internal/workflows/{workflowId}/published-version — the workflow's latest enabled version
 * (its definition, number and time), or null if it was never enabled. Write access only. The editor
 * reads it for "Discard changes".
 *
 * Internal (CODING_STANDARDS "API Design"): only the app calls it, so it is session-only, with no
 * OpenAPI entry and no stability promise.
 */
import { ZWorkflowIdInput } from "@formbricks/workflows";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getPublishedWorkflowVersion } from "../../lib/published-version";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZWorkflowIdInput },
  handler: async ({ parsedInput, authentication, requestId, instance }) =>
    getPublishedWorkflowVersion({ authentication, requestId, instance, params: parsedInput.params }),
});
