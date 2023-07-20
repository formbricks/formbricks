"use server";

import { createSurvey } from "@formbricks/lib/services/survey";

export async function createSurveyAction(environmentId: string, surveyBody: any) {
  return await createSurvey(environmentId, surveyBody);
}
