import { getResponse, getSurvey } from "@/modules/api/management/lib/services";
import { ResourceNotFoundError } from "@formbricks/types/errors";

export const getEnvironmentIdFromSurveyId = async (surveyId: string) => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    throw new ResourceNotFoundError("survey", surveyId);
  }

  return survey.environmentId;
};

export const getEnvironmentIdFromResponseId = async (responseId: string) => {
  const response = await getResponse(responseId);
  if (!response) {
    throw new ResourceNotFoundError("response", responseId);
  }

  return await getEnvironmentIdFromSurveyId(response.surveyId);
};
