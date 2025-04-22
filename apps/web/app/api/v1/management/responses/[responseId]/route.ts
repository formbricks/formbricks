import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { ZResponseUpdateInput } from "@formbricks/types/responses";

async function fetchAndAuthorizeResponse(
  responseId: string,
  authentication: any,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const response = await getResponse(responseId);
  if (!response) {
    return { error: responses.notFoundResponse("Response", responseId) };
  }

  const survey = await getSurvey(response.surveyId);
  if (!survey) {
    return { error: responses.notFoundResponse("Survey", response.surveyId, true) };
  }

  if (!hasPermission(authentication.environmentPermissions, survey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { response };
}

export const GET = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "GET");
    if (result.error) return result.error;

    return responses.successResponse(result.response);
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

    const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "DELETE");
    if (result.error) return result.error;

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

    const result = await fetchAndAuthorizeResponse(params.responseId, authentication, "PUT");
    if (result.error) return result.error;

    let responseUpdate;
    try {
      responseUpdate = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON");
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
