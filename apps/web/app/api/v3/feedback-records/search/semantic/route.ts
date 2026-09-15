/**
 * POST /api/v3/feedback-records/search/semantic — find records by meaning rather than by keyword.
 *
 * A POST because the search text belongs in a body: it is arbitrary user text of up to 2000
 * characters, and a query string would put it in access logs and referrers. Static segments, so this
 * never collides with `/api/v3/feedback-records/{feedbackRecordId}`.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { searchV3FeedbackRecords } from "../../lib/operations";
import { V3_SERIALIZERS } from "../../lib/serializers";
import { ZV3FeedbackRecordSemanticSearchBody, ZV3FeedbackRecordSimilarityQuery } from "../../query";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: { query: ZV3FeedbackRecordSimilarityQuery, body: ZV3FeedbackRecordSemanticSearchBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    searchV3FeedbackRecords({
      workspaceId: parsedInput.query.workspaceId,
      datasetId: parsedInput.query.datasetId,
      query: parsedInput.body.query,
      limit: parsedInput.query.limit,
      cursor: parsedInput.query.cursor,
      minScore: parsedInput.query.minScore,
      authentication,
      requestId,
      instance,
      serializers: V3_SERIALIZERS,
    }),
});
