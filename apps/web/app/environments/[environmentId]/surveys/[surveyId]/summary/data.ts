import { IS_FORMBRICKS_CLOUD, RESPONSES_LIMIT_FREE } from "@formbricks/lib/constants";
import { getSurveyResponses } from "@formbricks/lib/services/response";
import { getSurvey } from "@formbricks/lib/services/survey";
import { Session } from "next-auth";

export const getAnalysisData = async (session: Session, surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) throw new Error(`Survey not found: ${surveyId}`);
  const allResponses = await getSurveyResponses(surveyId);
  const limitReached =
    IS_FORMBRICKS_CLOUD && session?.user.plan === "free" && allResponses.length >= RESPONSES_LIMIT_FREE;
  const responses = limitReached ? allResponses.slice(0, RESPONSES_LIMIT_FREE) : allResponses;
  const responsesCount = allResponses.length;

  return { responses, responsesCount, limitReached, survey };
};
