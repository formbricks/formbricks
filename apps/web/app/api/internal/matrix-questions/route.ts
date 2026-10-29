/**
 * GET /api/internal/matrix-questions?workspaceId=…&datasetId=… — the matrix questions a Feedback Dataset
 * holds, for the matrix chart's "pick a question" setup.
 *
 * Internal surface (ENG-6583): the chart builder is the only caller and the shape exists to fill one
 * picker, so it has no OpenAPI entry and no compatibility promise. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listInternalMatrixQuestions } from "../charts/lib/operations";
import { ZInternalMatrixQuestionsQuery } from "../charts/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZInternalMatrixQuestionsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listInternalMatrixQuestions({ query: parsedInput.query, authentication, requestId, instance }),
});
