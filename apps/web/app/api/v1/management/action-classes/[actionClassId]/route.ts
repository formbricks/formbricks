import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { deleteActionClass, getActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

const fetchAndAuthorizeActionClass = async (
  authentication: TAuthenticationApiKey,
  actionClassId: string
): Promise<TActionClass | null> => {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    return null;
  }
  if (actionClass.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return actionClass;
};

export const GET = async (
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId);
    if (actionClass) {
      return responses.successResponse(actionClass);
    }
    return responses.notFoundResponse("Action Class", params.actionClassId);
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const PUT = async (
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId);
    if (!actionClass) {
      return responses.notFoundResponse("Action Class", params.actionClassId);
    }

    let actionClassUpdate;
    try {
      actionClassUpdate = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON: ${error}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZActionClassInput.safeParse(actionClassUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    const updatedActionClass = await updateActionClass(
      inputValidation.data.environmentId,
      params.actionClassId,
      inputValidation.data
    );
    if (updatedActionClass) {
      return responses.successResponse(updatedActionClass);
    }
    return responses.internalServerErrorResponse("Some error ocured while updating action");
  } catch (error) {
    return handleErrorResponse(error);
  }
};

export const DELETE = async (
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId);
    if (!actionClass) {
      return responses.notFoundResponse("Action Class", params.actionClassId);
    }
    if (actionClass.type === "automatic") {
      return responses.badRequestResponse("Automatic action classes cannot be deleted");
    }
    const deletedActionClass = await deleteActionClass(params.actionClassId);
    return responses.successResponse(deletedActionClass);
  } catch (error) {
    return handleErrorResponse(error);
  }
};
