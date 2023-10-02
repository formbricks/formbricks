import { responses } from "@/lib/api/response";
import { NextResponse } from "next/server";
import { deleteActionClass, getActionClass, updateActionClass } from "@formbricks/lib/actionClass/service";
import { TActionClass, ZActionClassInput } from "@formbricks/types/v1/actionClasses";
import { authenticateRequest } from "@/app/api/v1/auth";
import { transformErrorToDetails } from "@/lib/api/validator";
import { TAuthenticationApiKey } from "@formbricks/types/v1/auth";
import { handleErrorResponse } from "@/app/api/v1/auth";

async function fetchAndAuthorizeActionClass(
  authentication: TAuthenticationApiKey,
  actionClassId: string
): Promise<TActionClass | null> {
  const actionClass = await getActionClass(actionClassId);
  if (!actionClass) {
    return null;
  }
  if (actionClass.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return actionClass;
}

export async function GET(
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<NextResponse> {
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
}

export async function PUT(
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClass = await fetchAndAuthorizeActionClass(authentication, params.actionClassId);
    if (!actionClass) {
      return responses.notFoundResponse("Action Class", params.actionClassId);
    }
    const actionCLassUpdate = await request.json();
    const inputValidation = ZActionClassInput.safeParse(actionCLassUpdate);
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
}

export async function DELETE(
  request: Request,
  { params }: { params: { actionClassId: string } }
): Promise<NextResponse> {
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
    const deletedActionClass = await deleteActionClass(authentication.environmentId, params.actionClassId);
    return responses.successResponse(deletedActionClass);
  } catch (error) {
    return handleErrorResponse(error);
  }
}
