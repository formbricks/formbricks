import { responses } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { getSurvey, updateSurvey, deleteSurvey } from "@formbricks/lib/survey/service";
import { TSurvey, ZSurveyInput } from "@formbricks/types/v1/surveys";
import { transformErrorToDetails } from "@/lib/api/validator";
import { authenticateRequest } from "@/app/api/v1/auth";
import { handleErrorResponse } from "@/app/api/v1/auth";

async function fetchAndAuthorizeSurvey(authentication: any, surveyId: string): Promise<TSurvey | null> {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return null;
  }
  if (survey.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return survey;
}

export async function GET(
  request: Request,
  { params }: { params: { surveyId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (survey) {
      return responses.successResponse(survey);
    }
    return responses.notFoundResponse("Survey", params.surveyId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { surveyId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    const deletedSurvey = await deleteSurvey(params.surveyId);
    return responses.successResponse(deletedSurvey);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { surveyId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const survey = await fetchAndAuthorizeSurvey(authentication, params.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", params.surveyId);
    }
    const surveyUpdate = await request.json();
    const inputValidation = ZSurveyInput.safeParse(surveyUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    return responses.successResponse(await updateSurvey(inputValidation.data));
  } catch (error) {
    return handleErrorResponse(error);
  }
}
