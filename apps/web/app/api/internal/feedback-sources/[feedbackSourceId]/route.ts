import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { deleteFeedbackSourceOperation, updateFeedbackSourceOperation } from "../lib/operations";
import { ZFeedbackSourceIdParams, ZFeedbackSourceUpdateBody } from "../schemas";

/** `PATCH /api/internal/feedback-sources/{feedbackSourceId}`: change a source or its mappings. */
export const PATCH = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZFeedbackSourceIdParams, body: ZFeedbackSourceUpdateBody },
  action: "updated",
  targetType: "feedbackSource",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    updateFeedbackSourceOperation({
      authentication,
      feedbackSourceId: parsedInput.params.feedbackSourceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});

/** `DELETE /api/internal/feedback-sources/{feedbackSourceId}`: remove a source. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZFeedbackSourceIdParams },
  action: "deleted",
  targetType: "feedbackSource",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteFeedbackSourceOperation({
      authentication,
      feedbackSourceId: parsedInput.params.feedbackSourceId,
      requestId,
      instance,
      auditLog,
    }),
});
