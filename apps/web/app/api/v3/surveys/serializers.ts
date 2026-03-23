import type { TSurvey } from "@/modules/survey/list/types/surveys";

export type TV3SurveyListItem = Omit<TSurvey, "environmentId" | "singleUse"> & {
  workspaceId: string;
};

/**
 * Keep the v3 API contract isolated from internal persistence naming.
 * Internally surveys are still scoped by environmentId; externally v3 exposes workspaceId.
 */
export function serializeV3SurveyListItem(survey: TSurvey): TV3SurveyListItem {
  const { environmentId, singleUse: _omitSingleUse, ...rest } = survey;

  return {
    ...rest,
    workspaceId: environmentId,
  };
}
