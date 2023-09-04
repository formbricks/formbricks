import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError } from "@formbricks/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { transformErrorToDetails } from "@/lib/api/validator"
import { createSurvey, getSurveys } from "@formbricks/lib/services/survey";
import { ZSurveyInput } from "@formbricks/types/v1/surveys";
import { headers } from "next/headers";

export async function GET() {
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

  // get surveys from database
  try {
    const surveys = await getSurveys(apiKeyData.environmentId);
    return responses.successResponse(surveys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await getApiKeyFromKey(apiKey);
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }
  const surveyInput = await request.json();
  const inputValidation = ZSurveyInput.safeParse(surveyInput);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }
  // add survey to database
  try {
    const webhook = await createSurvey(apiKeyData.environmentId, inputValidation.data);
    return responses.successResponse(webhook);
  } catch (error) {
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
    throw error;
  }
}
