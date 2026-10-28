/**
 * POST /api/v3/feedback-queries — run a read-only Feedback query over a workspace's Feedback Dataset.
 *
 * A POST only because the query is a structured body; nothing is written. Session cookie, API key or OAuth
 * token. The query is the Cube query format of ADR 0001, validated against the field catalog and bounded.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { queryV3Feedback } from "./lib/operations";
import { ZV3FeedbackQueryBody } from "./lib/schemas";

export const POST = withV3ApiWrapper({
  auth: "both",
  schemas: { body: ZV3FeedbackQueryBody },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    queryV3Feedback({
      authentication,
      workspaceId: parsedInput.body.workspaceId,
      datasetId: parsedInput.body.datasetId,
      query: parsedInput.body.query,
      requestId,
      instance,
    }),
});
