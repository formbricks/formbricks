/**
 * GET /api/v3/unify-feedback/taxonomy/nodes/{nodeId}/records — a capped sample of the feedback records
 * assigned to a node and its visible descendants. No cursor/total (Hub caps the sample). Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { getV3TaxonomyNodeRecords } from "../../../lib/operations";
import { ZNodeIdParams, ZNodeRecordsQuery } from "../../../lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: {
    query: ZNodeRecordsQuery,
    params: ZNodeIdParams,
  },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getV3TaxonomyNodeRecords({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      directoryId: parsedInput.query.directoryId,
      nodeId: parsedInput.params.nodeId,
      limit: parsedInput.query.limit,
      requestId,
      instance,
    }),
});
