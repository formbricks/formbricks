import { getResponseCountBySurveyId } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";

export const getAnalysisData = async (surveyId: string, environmentId: string) => {
  const [survey, responseCount] = await Promise.all([
    getSurvey(surveyId),
    getResponseCountBySurveyId(surveyId),
  ]);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  if (survey.environmentId !== environmentId) throw new Error(`Survey not found: ${surveyId}`);

  return { responseCount, survey };
};
