import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listFeedbackRecordsOperation } from "./lib/operations";
import { ZFeedbackRecordListQuery } from "./schemas";

/** `GET /api/internal/feedback-records?workspaceId=&datasetId=`: one page of one dataset's records. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZFeedbackRecordListQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listFeedbackRecordsOperation({ authentication, query: parsedInput.query, requestId, instance }),
});
