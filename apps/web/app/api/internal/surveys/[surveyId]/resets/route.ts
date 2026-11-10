import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { resetSurveyOperation } from "./lib/operations";
import { ZSurveyResetParams } from "./schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/resets`: delete every response and display of the survey.
 * Audited as an update of the survey.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyResetParams },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    resetSurveyOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      requestId,
      instance,
      auditLog,
    }),
});
