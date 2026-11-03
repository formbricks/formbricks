/**
 * GET /api/internal/answer-questions?workspaceId=…&datasetId=… — the questions of a Feedback Dataset an
 * answer filter may name, for the chart builder's "Answer to question…" filter (ENG-6637).
 *
 * Internal surface (ENG-6583): the chart builder is the only caller and the shape exists to fill one
 * picker, so it has no OpenAPI entry and no compatibility promise. Session-only.
 */
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { listInternalAnswerQuestions } from "../charts/lib/operations";
import { ZInternalAnswerQuestionsQuery } from "../charts/lib/schemas";

export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZInternalAnswerQuestionsQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    listInternalAnswerQuestions({ query: parsedInput.query, authentication, requestId, instance }),
});
