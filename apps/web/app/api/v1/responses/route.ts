import { responses } from "@/lib/api/response";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { getEnvironmentResponses, getSurveyResponses } from "@formbricks/lib/services/response";
import { headers } from "next/headers";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { getSurvey } from "@formbricks/lib/services/survey";

export async function GET(request: Request) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  let apiKeyData;
  try {
    apiKeyData = await getApiKeyFromKey(apiKey);
    if (!apiKeyData) {
      return responses.notAuthenticatedResponse();
    }
  } catch (error) {
    return responses.notAuthenticatedResponse();
  }

  // get surveyId from searchParams
  const { searchParams } = new URL(request.url);
  const surveyId = searchParams.get("surveyId");

  // get responses from database
  try {
    if (!surveyId) {
      const environmentResponses = await getEnvironmentResponses(apiKeyData.environmentId);
      return responses.successResponse(environmentResponses);
    }
    // check if survey is part of environment
    const survey = await getSurvey(surveyId);
    if (!survey) {
      return responses.notFoundResponse(surveyId, "survey");
    }
    if (survey.environmentId !== apiKeyData.environmentId) {
      return responses.notFoundResponse(surveyId, "survey");
    }
    // get responses for survey
    const surveyResponses = await getSurveyResponses(surveyId);
    return responses.successResponse(surveyResponses);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}
