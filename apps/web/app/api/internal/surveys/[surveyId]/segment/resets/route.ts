import { resetSurveySegmentOperation } from "@/app/api/internal/segments/lib/operations";
import { ZSurveySegmentParams } from "@/app/api/internal/segments/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

/**
 * `POST /api/internal/surveys/{surveyId}/segment/resets`: give the survey its own private segment back, with
 * no filters. Licence-gated (advanced targeting). Audited as an update of that segment.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySegmentParams },
  action: "updated",
  targetType: "segment",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    resetSurveySegmentOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
      auditLog,
    }),
});
