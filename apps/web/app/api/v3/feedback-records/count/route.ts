/**
 * GET /api/v3/feedback-records/count — how many records match, without fetching them.
 *
 * A static segment, so it never collides with `/api/v3/feedback-records/{feedbackRecordId}`. Takes the
 * list filters and no pagination: the store's count endpoint rejects ordering, so `limit`, `cursor` and
 * `sortBy` are refused here rather than ignored.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { countV3FeedbackRecords } from "../lib/operations";
import { ZV3FeedbackRecordsCountQuery, toOperationFilters } from "../query";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3FeedbackRecordsCountQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    countV3FeedbackRecords({
      workspaceId: parsedInput.query.workspaceId,
      datasetId: parsedInput.query.datasetId,
      ...toOperationFilters(parsedInput.query),
      authentication,
      requestId,
      instance,
    }),
});
