import { authenticateRequest, handleErrorResponse, hasPermission } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

export const GET = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const response = await getResponse(params.responseId);
    if (!response) {
      return responses.notFoundResponse("Response", params.responseId);
    }
    const survey = await getSurvey(response.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", response.surveyId, true);
    }

    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "GET")) {
      return responses.unauthorizedResponse();
    }
    return responses.successResponse(response);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const response = await getResponse(params.responseId);
    if (!response) {
      return responses.notFoundResponse("Response", params.responseId);
    }
    const survey = await getSurvey(response.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", response.surveyId, true);
    }
    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "DELETE")) {
      return responses.unauthorizedResponse();
    }
    const deletedResponse = await deleteResponse(params.responseId);
    return responses.successResponse(deletedResponse);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const PUT = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const response = await getResponse(params.responseId);
    if (!response) {
      return responses.notFoundResponse("Response", params.responseId);
    }
    const survey = await getSurvey(response.surveyId);
    if (!survey) {
      return responses.notFoundResponse("Survey", response.surveyId, true);
    }
    if (!hasPermission(authentication.environmentPermissions, survey.environmentId, "PUT")) {
      return responses.unauthorizedResponse();
    }
    let responseUpdate;
    try {
      responseUpdate = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON: ${error}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

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
};
