import { RESPONSES_LIMIT_FREE } from "@formbricks/lib/constants";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getSurvey } from "@formbricks/lib/survey/service";
import { getResponses } from "@formbricks/lib/response/service";
import { getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { getDisplayCountBySurveyId } from "@formbricks/lib/display/service";

export const getAnalysisData = async (surveyId: string, environmentId: string) => {
  const [survey, team, allResponses, displayCount] = await Promise.all([
    getSurvey(surveyId),
    getTeamByEnvironmentId(environmentId),
    getResponses(surveyId),
    getDisplayCountBySurveyId(surveyId),
  ]);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  if (!team) throw new Error(`Team not found for environment: ${environmentId}`);
  if (survey.environmentId !== environmentId) throw new Error(`Survey not found: ${surveyId}`);
  const limitReached =
    IS_FORMBRICKS_CLOUD &&
    team.plan === "free" &&
    survey.type === "web" &&
    allResponses.length >= RESPONSES_LIMIT_FREE;
  const responses = limitReached ? allResponses.slice(0, RESPONSES_LIMIT_FREE) : allResponses;
  const responseCount = allResponses.length;

  return { responses, responseCount, limitReached, survey, displayCount };
};
