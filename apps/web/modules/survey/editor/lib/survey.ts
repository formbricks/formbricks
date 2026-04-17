import { TSurvey } from "@formbricks/types/surveys/types";
import { updateSurveyInternal } from "@/lib/survey/service";

export { checkTriggersValidity, handleTriggerUpdates } from "@/modules/survey/lib/trigger-updates";

export const updateSurveyDraft = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  // Use the internal variant with validation disabled so drafts can remain incomplete while editing.
  return updateSurveyInternal(updatedSurvey, true);
};

export const updateSurvey = async (updatedSurvey: TSurvey): Promise<TSurvey> => {
  return updateSurveyInternal(updatedSurvey);
};
