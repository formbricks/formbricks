import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { getApiKeyFromKey } from "@formbricks/lib/services/apiKey";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { transformErrorToDetails } from "@/lib/api/validator";
import { deleteResponse, getResponse, updateResponse } from "@formbricks/lib/services/response";
import { ZResponseUpdateInput } from "@formbricks/types/v1/responses";
import { getAuthentication } from "@/app/api/v1/auth";


export async function GET(request : Request, { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  const authentication = await getAuthentication(request)
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const response = await getResponse(params.responseId);
    if (!response) {
      return responses.notFoundResponse("Response", params.responseId);
    }
    return responses.successResponse(response);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(_: Request, { params }: { params: { responseId: string } }) {
  const apiKey = headers().get("x-api-key");
  if (!apiKey) {
    return responses.notAuthenticatedResponse();
  }
  const apiKeyData = await getApiKeyFromKey(apiKey);
  if (!apiKeyData) {
    return responses.notAuthenticatedResponse();
  }

  // delete webhook from database
  try {
    const response = await deleteResponse(params.responseId);
    return responses.successResponse(response);
  } catch (e) {
    return responses.notFoundResponse("Response", params.responseId);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { responseId: string } }
): Promise<NextResponse> {
  const { responseId } = params;

  if (!responseId) {
    return responses.badRequestResponse("responseId ID is missing", undefined, true);
  }

  const responseUpdate = await request.json();
  const inputValidation = ZResponseUpdateInput.safeParse(responseUpdate);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // update response
  let response;
  try {
    response = await updateResponse(responseId, inputValidation.data);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Response", responseId, true);
    }
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
  }
  return responses.successResponse(response, true);
}

function handleErrorResponse(error: any): NextResponse {
  if (error instanceof DatabaseError) {
    return responses.badRequestResponse(error.message);
  }
  return responses.notAuthenticatedResponse();
}
