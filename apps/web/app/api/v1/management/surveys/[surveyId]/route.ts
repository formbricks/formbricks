import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { NextResponse } from "next/server";
import { getSurvey, updateSurvey, deleteSurvey } from "@formbricks/lib/services/survey";
import { TSurvey, ZSurveyInput } from "@formbricks/types/v1/surveys";
import { transformErrorToDetails } from "@/lib/api/validator";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { authenticateRequest } from "@/app/api/v1/auth";

async function fetchAndValidateSurvey(authentication: any, surveyId: string): Promise<TSurvey | null> {
  const survey = await getSurvey(surveyId);
  if (!survey) {
    return null;
  }
  if (!(await canUserAccessSurvey(authentication, survey))) {
    throw new Error("Unauthorized");
  }
  return survey;
}

const canUserAccessSurvey = async (authentication: any, survey: TSurvey): Promise<boolean> => {
  if (!authentication) return false;

  if (authentication.type === "session") {
    return await hasUserEnvironmentAccess(authentication.session.user, survey.environmentId);
  } else if (authentication.type === "apiKey") {
    return survey.environmentId === authentication.environmentId;
  } else {
    throw Error("Unknown authentication type");
  }
};

export async function GET(
  request: Request,
  { params }: { params: { surveyId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const survey = await fetchAndValidateSurvey(authentication, params.surveyId);
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
    const survey = await fetchAndValidateSurvey(authentication, params.surveyId);
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
    const survey = await fetchAndValidateSurvey(authentication, params.surveyId);
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

function handleErrorResponse(error: any): NextResponse {
  switch (error.message) {
    case "NotAuthenticated":
      return responses.notAuthenticatedResponse();
    case "Unauthorized":
      return responses.unauthorizedResponse();
    default:
      if (
        error instanceof DatabaseError ||
        error instanceof InvalidInputError ||
        error instanceof ResourceNotFoundError
      ) {
        return responses.badRequestResponse(error.message);
      }
      return responses.internalServerErrorResponse("Some error occurred");
  }
}
