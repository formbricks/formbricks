/**
 * GET /api/v3/feedback-datasets — the feedback datasets a workspace can reach.
 *
 * Exposed because `datasetId` appears nowhere in the app's UI, and without this the only public route
 * to it was to install an MCP server or ask us. A workspace reaches at most one active dataset, so
 * this is discovery rather than pagination: `meta.nextCursor` is always `null`.
 *
 * Its response carries no record fields, so there is nothing to re-spell and no serializer to choose.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listV3FeedbackDatasets } from "../feedback-records/lib/operations";
import { ZV3FeedbackDatasetsQuery } from "../feedback-records/query";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3FeedbackDatasetsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listV3FeedbackDatasets({
      workspaceId: parsedInput.query.workspaceId,
      authentication,
      requestId,
      instance,
    }),
});
