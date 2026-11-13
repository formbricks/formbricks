import { attachSurveySegmentOperation } from "@/app/api/internal/segments/lib/operations";
import { ZSurveySegmentBody, ZSurveySegmentParams } from "@/app/api/internal/segments/schemas";
import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";

/**
 * `PUT /api/internal/surveys/{surveyId}/segment`: make the survey target the saved segment the body names.
 * Licence-gated (advanced targeting). Audited as an update of the survey.
 */
export const PUT = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveySegmentParams, body: ZSurveySegmentBody },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    attachSurveySegmentOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      segmentId: parsedInput.body.segmentId,
      requestId,
      instance,
      auditLog,
    }),
});
