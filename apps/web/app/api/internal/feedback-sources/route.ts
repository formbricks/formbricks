import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { createFeedbackSourceOperation } from "./lib/operations";
import { ZFeedbackSourceCreateBody, ZFeedbackSourceWorkspaceQuery } from "./schemas";

/** `POST /api/internal/feedback-sources?workspaceId=`: add a feedback source and its mappings. */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { query: ZFeedbackSourceWorkspaceQuery, body: ZFeedbackSourceCreateBody },
  action: "created",
  targetType: "feedbackSource",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    createFeedbackSourceOperation({
      authentication,
      workspaceId: parsedInput.query.workspaceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
