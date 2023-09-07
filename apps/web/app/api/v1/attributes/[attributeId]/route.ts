import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { NextResponse } from "next/server";
import { getAuthentication } from "@/app/api/v1/auth";
import {
  deleteAttributeClass,
  getAttributeClass,
  updatetAttributeClass,
} from "@formbricks/lib/services/attributeClass";
import { ZAttributeClassUpdateInput } from "@formbricks/types/v1/attributeClasses";
import { transformErrorToDetails } from "@/lib/api/validator";

export async function GET(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  const attributeId = params.attributeId;
  const authentication = await getAuthentication(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const attribute = await getAttributeClass(attributeId);
    if (!attribute) {
      return responses.notFoundResponse("Attribute", attributeId);
    }
    return responses.successResponse(attribute);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  const attributeId = params.attributeId;
  const authentication = await getAuthentication(request);
  if (!authentication) {
    return responses.notAuthenticatedResponse();
  }
  try {
    const attribute = await deleteAttributeClass(attributeId);
    if (!attribute) {
      return responses.notFoundResponse("Attribute", attributeId);
    }
    return responses.successResponse(attribute);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  const { attributeId } = params;

  if (!attributeId) {
    return responses.badRequestResponse("responseId ID is missing", undefined, true);
  }

  const attributeClassUpdate = await request.json();
  const inputValidation = ZAttributeClassUpdateInput.safeParse(attributeClassUpdate);

  if (!inputValidation.success) {
    return responses.badRequestResponse(
      "Fields are missing or incorrectly formatted",
      transformErrorToDetails(inputValidation.error),
      true
    );
  }

  // update attribute
  let attribute;
  try {
    attribute = await updatetAttributeClass(attributeId, inputValidation.data);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return responses.notFoundResponse("Attribute", attributeId, true);
    }
    if (error instanceof InvalidInputError) {
      return responses.badRequestResponse(error.message);
    }
    if (error instanceof DatabaseError) {
      return responses.internalServerErrorResponse(error.message);
    }
  }
  return responses.successResponse(attribute, true);
}

function handleErrorResponse(error: any): NextResponse {
  if (error instanceof DatabaseError) {
    return responses.badRequestResponse(error.message);
  }
  return responses.notAuthenticatedResponse();
}
