import { SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE } from "@/lib/survey/visibility/outbound";
import type { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";

/** The v2 400 for an outbound connection naming a survey that is not workspace-visible (ENG-3283). */
export const surveyNotWorkspaceVisibleError = (surveyIds: ReadonlyArray<string>): ApiErrorResponseV2 => ({
  type: "bad_request",
  details: surveyIds.map((surveyId) => ({
    field: "surveyIds",
    issue: `${SURVEY_NOT_WORKSPACE_VISIBLE_MESSAGE}: ${surveyId}`,
  })),
});
