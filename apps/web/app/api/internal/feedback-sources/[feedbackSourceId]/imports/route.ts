import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { importFeedbackSourceResponsesOperation } from "../../lib/operations";
import { ZFeedbackSourceIdParams, ZFeedbackSourceImportBody } from "../../schemas";

/**
 * `POST /api/internal/feedback-sources/{feedbackSourceId}/imports`: replay a mapped survey's past
 * responses into the source. Bounded by its own hourly budget; each import walks every response.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZFeedbackSourceIdParams, body: ZFeedbackSourceImportBody },
  action: "updated",
  targetType: "feedbackSource",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    importFeedbackSourceResponsesOperation({
      authentication,
      feedbackSourceId: parsedInput.params.feedbackSourceId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
