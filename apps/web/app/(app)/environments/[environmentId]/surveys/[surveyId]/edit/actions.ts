"use server";

import { TSurvey } from "@formbricks/types/v1/surveys";
import { updateSurvey } from "@formbricks/lib/services/survey";

export async function surveyMutateAction(survey: TSurvey): Promise<TSurvey> {
  return await updateSurvey(survey);
}
