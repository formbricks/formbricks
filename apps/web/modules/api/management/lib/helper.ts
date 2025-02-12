import { getResponse, getSurvey } from "@/modules/api/management/lib/services";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { Result, ok } from "@formbricks/types/error-handlers";

export const getEnvironmentIdFromSurveyId = async (
  surveyId: string
): Promise<Result<string, ApiErrorResponse>> => {
  const surveyResult = await getSurvey(surveyId);

  if (!surveyResult.ok) {
    return surveyResult;
  }

  return ok(surveyResult.data.environmentId);
};

export const getEnvironmentIdFromResponseId = async (
  responseId: string
): Promise<Result<string, ApiErrorResponse>> => {
  const responseResult = await getResponse(responseId);

  if (!responseResult.ok) {
    return responseResult;
  }

  return await getEnvironmentIdFromSurveyId(responseResult.data.surveyId);
};
