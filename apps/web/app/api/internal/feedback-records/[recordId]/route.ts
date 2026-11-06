import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { deleteFeedbackRecordOperation, getFeedbackRecordOperation } from "../lib/operations";
import { ZFeedbackRecordParams, ZFeedbackRecordWorkspaceQuery } from "../schemas";

/** `GET /api/internal/feedback-records/{recordId}?workspaceId=`: a record and its taxonomy placement. */
export const GET = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZFeedbackRecordParams, query: ZFeedbackRecordWorkspaceQuery },
  handler: async ({ authentication, parsedInput, requestId, instance }) =>
    getFeedbackRecordOperation({
      authentication,
      recordId: parsedInput.params.recordId,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
    }),
});

/** `DELETE /api/internal/feedback-records/{recordId}?workspaceId=`: delete a record. */
export const DELETE = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZFeedbackRecordParams, query: ZFeedbackRecordWorkspaceQuery },
  action: "deleted",
  targetType: "feedbackRecord",
  // Its own bucket rather than the shared one: the records table deletes a selection one record at a
  // time, so a bulk delete would otherwise drain every other route's budget for this user.
  customRateLimitConfig: rateLimitConfigs.actions.feedbackRecordDeletion,
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    deleteFeedbackRecordOperation({
      authentication,
      recordId: parsedInput.params.recordId,
      workspaceId: parsedInput.query.workspaceId,
      requestId,
      instance,
      auditLog,
    }),
});
