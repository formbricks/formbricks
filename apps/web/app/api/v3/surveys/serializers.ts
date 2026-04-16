import type { TSurvey as TFullSurvey } from "@formbricks/types/surveys/types";
import type { TSurvey } from "@/modules/survey/list/types/surveys";

export type TV3SurveyListItem = Omit<TSurvey, "environmentId" | "singleUse"> & {
  workspaceId: string;
};

export type TV3SurveyResource = {
  id: TFullSurvey["id"];
  workspaceId: string;
  createdAt: TFullSurvey["createdAt"];
  updatedAt: TFullSurvey["updatedAt"];
  name: TFullSurvey["name"];
  type: TFullSurvey["type"];
  status: TFullSurvey["status"];
  welcomeCard: TFullSurvey["welcomeCard"];
  blocks: TFullSurvey["blocks"];
  endings: TFullSurvey["endings"];
  hiddenFields: TFullSurvey["hiddenFields"];
  variables: TFullSurvey["variables"];
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

export function serializeV3SurveyResource(survey: TFullSurvey): TV3SurveyResource {
  return {
    id: survey.id,
    workspaceId: survey.environmentId,
    createdAt: survey.createdAt,
    updatedAt: survey.updatedAt,
    name: survey.name,
    type: survey.type,
    status: survey.status,
    welcomeCard: survey.welcomeCard,
    blocks: survey.blocks,
    endings: survey.endings,
    hiddenFields: survey.hiddenFields,
    variables: survey.variables,
  };
}
