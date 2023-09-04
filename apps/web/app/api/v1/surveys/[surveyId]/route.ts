import { responses } from "@/lib/api/response";
import { DatabaseError,InvalidInputError,ResourceNotFoundError } from "@formbricks/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { getSurvey, updateSurvey } from "@formbricks/lib/services/survey";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSurvey } from "@formbricks/lib/services/survey";
import { ZSurveyInput } from "@formbricks/types/v1/surveys";
import { transformErrorToDetails } from "@/lib/api/validator";


export async function GET(_: Request, { params }: { params: { surveyId: string } }
): Promise<NextResponse> {
    const apiKey = headers().get("x-api-key");
    if (!apiKey) {
        return responses.notAuthenticatedResponse();
    }
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (!apiKeyData) {
        return responses.notAuthenticatedResponse();
    }
    try {
        const survey = await getSurvey(params.surveyId);
        if (!survey) {
            return responses.notFoundResponse("Survey", params.surveyId);
        }
        if (survey.environmentId !== apiKeyData.environmentId) {
            return responses.unauthorizedResponse();
        }
        return responses.successResponse(survey);
    } catch (error) {
        return handleErrorResponse(error);
    }
}

export async function DELETE(_: Request, { params }: { params: { surveyId: string } }) {
    const apiKey = headers().get("x-api-key");
    if (!apiKey) {
        return responses.notAuthenticatedResponse();
    }
    const apiKeyData = await getApiKeyFromKey(apiKey);
    if (!apiKeyData) {
        return responses.notAuthenticatedResponse();
    }

    // delete webhook from database
    try {
        const survey = await deleteSurvey(params.surveyId);
        return responses.successResponse(survey);
    } catch (e) {
        return responses.notFoundResponse("survey", params.surveyId);
    }
}

export async function PUT(
    request: Request,
    { params }: { params: { surveyId: string } }
  ): Promise<NextResponse> {
    const { surveyId } = params;
  
    if (!surveyId) {
      return responses.badRequestResponse("surveyId ID is missing", undefined, true);
    }
  
    const surveyUpdate = await request.json();
  
    const inputValidation = ZSurveyInput.safeParse(surveyUpdate);
  
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }
  
    // update response
    let survey;
    try {
      survey = await updateSurvey(surveyId,inputValidation.data);
    } catch (error) {
      if (error instanceof ResourceNotFoundError) {
        return responses.notFoundResponse("Survey", surveyId, true);
      }
      if (error instanceof InvalidInputError) {
        return responses.badRequestResponse(error.message);
      }
      if (error instanceof DatabaseError) {
        return responses.internalServerErrorResponse(error.message);
      }
    }
    return responses.successResponse(survey, true);
  }
  
function handleErrorResponse(error: any): NextResponse {
    if (error instanceof DatabaseError) {
        return responses.badRequestResponse(error.message);
    }
    return responses.notAuthenticatedResponse();
}
