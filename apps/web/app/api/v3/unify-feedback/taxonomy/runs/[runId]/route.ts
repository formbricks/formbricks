/**
 * GET /api/v3/unify-feedback/taxonomy/runs/{runId} — poll a taxonomy run's status. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3TaxonomyRun } from "../../lib/operations";
import { ZRunIdParams, ZWorkspaceDirectoryQuery } from "../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZWorkspaceDirectoryQuery,
    params: ZRunIdParams,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3TaxonomyRun({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      runId: parsedInput.params.runId,
      requestId,
      instance,
    }),
});
