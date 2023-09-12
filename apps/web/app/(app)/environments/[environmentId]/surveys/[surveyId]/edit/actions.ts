"use server";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { deleteSurvey, updateSurvey } from "@formbricks/lib/services/survey";

export async function surveyMutateAction(survey: TSurvey): Promise<TSurvey> {
  return await updateSurvey(survey);
}

export async function deleteSurveyAction(surveyId: string) {
  await deleteSurvey(surveyId);
}
