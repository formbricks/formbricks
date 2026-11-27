import { withV3ApiWrapper } from "@/app/api/v3/lib/api-wrapper";
import { SURVEY_SAVE_ARRAY_BUDGET, SURVEY_SAVE_MAX_BODY_BYTES } from "../lib/limits";
import { saveSurveyDraftOperation } from "../lib/operations";
import { ZSurveyDraftSaveBody, ZSurveySaveParams } from "../schemas";

/**
 * `PUT /api/internal/surveys/{surveyId}/draft`: save a draft as it stands, from the editor's draft save and
 * its 10-second autosave. Checked loosely (`ZSurveyDraft`) and in full on publish; it replaces
 * `updateSurveyDraftAction`. The same caps as the full save. Audited as `updated` on the survey.
 */
export const PUT = withV3ApiWrapper({
  auth: "session",
  bodyLimitBytes: SURVEY_SAVE_MAX_BODY_BYTES,
  arrayBudget: SURVEY_SAVE_ARRAY_BUDGET,
  schemas: { params: ZSurveySaveParams, body: ZSurveyDraftSaveBody },
  action: "updated",
  targetType: "survey",
  handler: async ({ authentication, parsedInput, requestId, instance, auditLog }) =>
    saveSurveyDraftOperation({
      authentication,
      surveyId: parsedInput.params.surveyId,
      body: parsedInput.body,
      requestId,
      instance,
      auditLog,
    }),
});
