import { getResponse, getSurvey } from "@/modules/api/management/lib/services";
import { ApiErrorResponse } from "@/modules/api/types/api-error";
import { Result, err, ok } from "@formbricks/types/error-handlers";

export const getEnvironmentIdFromSurveyId = async (
  surveyId: string
): Promise<Result<string, ApiErrorResponse>> => {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return err({ type: "not_found", details: [{ field: "survey", issue: "not found" }] });
  }

  return ok(survey.environmentId);
};

export const getEnvironmentIdFromResponseId = async (
  responseId: string
): Promise<Result<string, ApiErrorResponse>> => {
  const response = await getResponse(responseId);
  if (!response) {
    return err({ type: "not_found", details: [{ field: "response", issue: "not found" }] });
  }

  return await getEnvironmentIdFromSurveyId(response.surveyId);
};
