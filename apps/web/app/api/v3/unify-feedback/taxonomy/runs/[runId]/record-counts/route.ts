/**
 * GET /api/v3/unify-feedback/taxonomy/runs/{runId}/record-counts — per-node distinct feedback-record
 * counts (subtree totals) for a taxonomy run. One entry per visible node; feeds the tree/records
 * count badges. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3TaxonomyNodeRecordCounts } from "../../../lib/operations";
import { ZRunIdParams, ZWorkspaceDirectoryQuery } from "../../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZWorkspaceDirectoryQuery,
    params: ZRunIdParams,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3TaxonomyNodeRecordCounts({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      runId: parsedInput.params.runId,
      requestId,
      instance,
    }),
});
