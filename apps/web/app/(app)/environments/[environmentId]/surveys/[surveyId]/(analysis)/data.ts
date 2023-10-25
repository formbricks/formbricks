import { getDisplayCountBySurveyId } from "@formbricks/lib/display/service";
import { getResponses } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";

export const getAnalysisData = async (surveyId: string, environmentId: string) => {
  const [survey, team, responses, displayCount] = await Promise.all([
    getSurvey(surveyId),
    getTeamByEnvironmentId(environmentId),
    getResponses(surveyId),
    getDisplayCountBySurveyId(surveyId),
  ]);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  if (!team) throw new Error(`Team not found for environment: ${environmentId}`);
  if (survey.environmentId !== environmentId) throw new Error(`Survey not found: ${surveyId}`);
  const responseCount = responses.length;

  return { responses, responseCount, survey, displayCount };
};

export const getAnalysisDataForSharing = async (surveyId: string) => {
  const [survey, responses, displayCount] = await Promise.all([
    getSurvey(surveyId),
    getResponses(surveyId),
    getDisplayCountBySurveyId(surveyId),
  ]);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);

  const responseCount = responses.length;

  return { responses, responseCount, survey, displayCount };
};
