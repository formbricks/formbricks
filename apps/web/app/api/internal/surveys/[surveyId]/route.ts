import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { SURVEY_SAVE_ARRAY_BUDGET, SURVEY_SAVE_MAX_BODY_BYTES } from "./lib/limits";
import { saveSurveyOperation } from "./lib/operations";
import { ZSurveySaveBody, ZSurveySaveParams } from "./schemas";

/**
 * `PUT /api/internal/surveys/{surveyId}`: the survey editor's save, publish and schedule, and the summary
 * page's status change and share settings. The whole survey in the editor's `ZSurvey` shape, validated in
 * full; it replaces `updateSurveyAction`. Held to the save caps in `./lib/limits.ts`, a larger body and
 * longer arrays than the defaults, since the body is a whole survey. Audited as `updated` on the survey.
 */
export const PUT = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_SAVE_MAX_BODY_BYTES,
  arrayBudget: SURVEY_SAVE_ARRAY_BUDGET,
  schemas: { params: ZSurveySaveParams, body: ZSurveySaveBody },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    saveSurveyOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
