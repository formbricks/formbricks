import { responses } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@formbricks/lib/response/service";
import { TResponse, ZResponseUpdateInput } from "@formbricks/types/v1/responses";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getSurvey } from "@formbricks/lib/survey/service";
import { authenticateRequest } from "@/app/api/v1/auth";
import { handleErrorResponse } from "@/app/api/v1/auth";

async function fetchAndValidateResponse(authentication: any, responseId: string): Promise<TResponse> {
  const response = await getResponse(responseId);
  if (!response || !(await canUserAccessResponse(authentication, response))) {
    throw new Error("Unauthorized");
  }
  return response;
}

const canUserAccessResponse = async (authentication: any, response: TResponse): Promise<boolean> => {
  const survey = await getSurvey(response.surveyId);
  if (!survey) return false;

  if (authentication.type === "session") {
    return await hasUserEnvironmentAccess(authentication.session.user.id, survey.environmentId);
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
    if (!authentication) return responses.notAuthenticatedResponse();
    await fetchAndValidateResponse(authentication, params.responseId);
    const response = await fetchAndValidateResponse(authentication, params.responseId);
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
    if (!authentication) return responses.notAuthenticatedResponse();
    const response = await fetchAndValidateResponse(authentication, params.responseId);
    if (!response) {
      return responses.notFoundResponse("Response", params.responseId);
    }
    const deletedResponse = await deleteResponse(params.responseId);
    return responses.successResponse(deletedResponse);
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
    if (!authentication) return responses.notAuthenticatedResponse();
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
