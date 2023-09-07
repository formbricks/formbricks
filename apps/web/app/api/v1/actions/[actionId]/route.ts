import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@formbricks/lib/services/response";
import { ZResponseUpdateInput } from "@formbricks/types/v1/responses";
import { getAuthentication } from "@/app/api/v1/auth";
import { deleteActionClass, getActionClass } from "@formbricks/lib/services/actionClass";

export async function GET(
  request: Request,
  { params }: { params: { actionId: string } }
): Promise<NextResponse> {
  const actionClassId = params.actionId;
  const authentication = await getAuthentication(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const action = await getActionClass(actionClassId);
    if (!action) {
      return responses.notFoundResponse("Action", actionClassId);
    }
    return responses.successResponse(action);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { actionId: string } }
): Promise<NextResponse> {
  const actionClassId = params.actionId;
  const authentication = await getAuthentication(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const action = await deleteActionClass(authentication.environmentId!, actionClassId);
    if (!action) {
      return responses.notFoundResponse("Action", actionClassId);
    }
    return responses.successResponse(action);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

function handleErrorResponse(error: any): NextResponse {
  if (error instanceof DatabaseError) {
    return responses.badRequestResponse(error.message);
  }
  return responses.notAuthenticatedResponse();
}
