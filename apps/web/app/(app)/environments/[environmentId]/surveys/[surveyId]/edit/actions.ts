"use server";

import { TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { updateSurvey } from "@formbricks/lib/services/survey";

export async function surveyMutateAction(surveyId: string, survey: TSurveyWithAnalytics) {
  return await updateSurvey(surveyId, survey);
}
