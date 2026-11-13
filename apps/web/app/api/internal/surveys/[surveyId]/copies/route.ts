import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { copySurveyOperation } from "./lib/operations";
import { ZSurveyCopyBody, ZSurveyCopyParams } from "./schemas";

/**
 * `POST /api/internal/surveys/{surveyId}/copies`: copy the survey into a workspace of its organization,
 * its own included. Audited on the source survey.
 */
export const POST = withV3ApiWrapper({
  auth: "session",
  schemas: { params: ZSurveyCopyParams, body: ZSurveyCopyBody },
  action: "copiedToOtherWorkspace",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    copySurveyOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
