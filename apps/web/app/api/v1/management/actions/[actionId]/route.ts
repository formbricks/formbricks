import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { NextResponse } from "next/server";
import { deleteActionClass, getActionClass } from "@formbricks/lib/services/actionClass";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { authenticateRequest } from "@/app/api/v1/auth";

async function fetchAndValidateSurvey(
  authentication: any,
  actionClassId: string
): Promise<TActionClass | null> {
  const action = await getActionClass(actionClassId);
  if (!action) {
    return null;
  }
  if (!(await canUserAccessAction(authentication, action))) {
    throw new Error("Unauthorized");
  }
  return action;
}

const canUserAccessAction = async (authentication: any, action: TActionClass): Promise<boolean> => {
  if (!authentication) return false;

  if (authentication.type === "session") {
    return await hasUserEnvironmentAccess(authentication.session.user, action.environmentId);
  } else if (authentication.type === "apiKey") {
    return action.environmentId === authentication.environmentId;
  } else {
    throw Error("Unknown authentication type");
  }
};

export async function GET(
  request: Request,
  { params }: { params: { actionId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const action = await fetchAndValidateSurvey(authentication, params.actionId);
    if (action) {
      return responses.successResponse(action);
    }
    return responses.notFoundResponse("Action", params.actionId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { actionId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const action = await fetchAndValidateSurvey(authentication, params.actionId);
    if (!action) {
      return responses.notFoundResponse("Survey", params.actionId);
    }
    const deletedAction = await deleteActionClass(authentication.environmentId!, params.actionId);
    return responses.successResponse(deletedAction);
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
