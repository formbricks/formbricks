import type { TSurvey } from "@/modules/survey/list/types/surveys";

export type TV3SurveyListItem = Omit<TSurvey, "singleUse">;

/**
 * Keep the v3 API contract isolated from internal persistence naming.
 * Surveys are scoped by workspaceId.
 */
export function serializeV3SurveyListItem(survey: TSurvey): TV3SurveyListItem {
  const { singleUse: _omitSingleUse, ...rest } = survey;

  return rest;
}
