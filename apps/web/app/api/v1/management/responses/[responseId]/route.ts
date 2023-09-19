import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@formbricks/lib/services/response";
import { TResponse, ZResponseUpdateInput } from "@formbricks/types/v1/responses";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { getSurvey } from "@formbricks/lib/services/survey";
import { authenticateRequest } from "@/app/api/v1/auth";

async function fetchAndValidateResponse(authentication: any, responseId: string): Promise<TResponse> {
  const response = await getResponse(responseId);
  if (!response || !(await canUserAccessResponse(authentication, response))) {
    throw new Error("Unauthorized");
  }
  return response;
}

const canUserAccessResponse = async (authentication: any, response: TResponse): Promise<boolean> => {
  if (!authentication) return false;

  const survey = await getSurvey(response.surveyId);
  if (!survey) return false;

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
  { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    await fetchAndValidateResponse(authentication, params.responseId);
    const response = await getResponse(params.responseId);
    if (response) {
      return responses.successResponse(response);
    }
    return responses.notFoundResponse("Response", params.responseId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    await fetchAndValidateResponse(authentication, params.responseId);
    return responses.successResponse(await deleteResponse(params.responseId));
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    await fetchAndValidateResponse(authentication, params.responseId);

    const responseUpdate = await request.json();
    const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    return responses.successResponse(await updateResponse(params.responseId, inputValidation.data));
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
      return responses.internalServerErrorResponse("Some error occured");
  }
}
