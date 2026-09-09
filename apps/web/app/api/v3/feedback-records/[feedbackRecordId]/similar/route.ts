/**
 * GET /api/v3/feedback-records/{feedbackRecordId}/similar — the records closest to this one by
 * embedding distance.
 *
 * Answers 409 when the record has no embedding yet, which is a real state rather than an error: text
 * is embedded asynchronously after it is stored, so a record created a moment ago is not yet
 * searchable. 503 on an instance with no embedding model configured at all.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { findSimilarV3FeedbackRecords } from "../../lib/operations";
import { V3_SERIALIZERS } from "../../lib/serializers";
import { ZV3FeedbackRecordIdParams, ZV3FeedbackRecordSimilarityQuery } from "../../query";

export const GET = withV3ApiWrapper({
  auth: "both",
  schemas: { params: ZV3FeedbackRecordIdParams, query: ZV3FeedbackRecordSimilarityQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    findSimilarV3FeedbackRecords({
      workspaceId: parsedInput.query.workspaceId,
      datasetId: parsedInput.query.datasetId,
      feedbackRecordId: parsedInput.params.feedbackRecordId,
      limit: parsedInput.query.limit,
      cursor: parsedInput.query.cursor,
      minScore: parsedInput.query.minScore,
      authentication,
      requestId,
      instance,
      serializers: V3_SERIALIZERS,
    }),
});
