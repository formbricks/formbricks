import { getSurvey } from "@formbricks/lib/survey/service";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { TSurvey } from "@formbricks/types/surveys";

export const fetchAndAuthorizeSurvey = async (
  authentication: TAuthenticationApiKey,
  surveyId: string
): Promise<TSurvey | null> => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return null;
  }
  if (survey.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return survey;
};
