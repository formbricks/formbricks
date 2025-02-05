import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { authenticatedAPIClient, checkAuthorization } from "@/modules/api/management/auth";
import { getEnvironmentIdFromResponseId } from "@/modules/api/management/lib/helper";
import { deleteResponse } from "@/modules/api/management/responses/[responseId]/lib/response";
import { z } from "zod";
import { hasUserEnvironmentAccess } from "@formbricks/lib/environment/auth";
import { getResponse, updateResponse } from "@formbricks/lib/response/service";
import { getSurvey } from "@formbricks/lib/survey/service";
import { validateInputs } from "@formbricks/lib/utils/validate";
import { TResponse, ZResponseUpdateInput } from "@formbricks/types/responses";

const fetchAndValidateResponse = async (authentication: any, responseId: string): Promise<TResponse> => {
  const response = await getResponse(responseId);
  if (!response || !(await canUserAccessResponse(authentication, response))) {
    throw new Error("Unauthorized");
  }
  return response;
};

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

export const GET = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const response = await fetchAndValidateResponse(authentication, params.responseId);
    if (response) {
      return responses.successResponse(response);
    }
    return responses.notFoundResponse("Response", params.responseId);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = (request: Request, props: { params: Promise<{ responseId: string }> }) =>
  authenticatedAPIClient({
    request,
    handler: async ({ authentication }) => {
      const params = await props.params;

      const [parsedResponseId] = validateInputs([params.responseId, z.string().cuid2()]);

      checkAuthorization({
        authentication,
        environmentId: await getEnvironmentIdFromResponseId(parsedResponseId),
      });

      const response = await deleteResponse(parsedResponseId);

      return responses.successResponse(response);
    },
  });

export const PUT = async (
  request: Request,
  props: { params: Promise<{ responseId: string }> }
): Promise<Response> => {
  const params = await props.params;
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    await fetchAndValidateResponse(authentication, params.responseId);
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
