import { responses } from "@/lib/api/response";
import { handleErrorResponse } from "@/app/api/v1/auth";
import { NextResponse } from "next/server";
import {
  deleteAttributeClass,
  getAttributeClass,
  updatetAttributeClass,
} from "@formbricks/lib/attributeClass/service";
import { TAttributeClass, ZAttributeClassUpdateInput } from "@formbricks/types/v1/attributeClasses";
import { transformErrorToDetails } from "@/lib/api/validator";
import { authenticateRequest } from "@/app/api/v1/auth";
import { TAuthenticationApiKey } from "@formbricks/types/v1/auth";

async function fetchAndAuthorizeAttributeClass(
  authentication: TAuthenticationApiKey,
  attributeId: string
): Promise<TAttributeClass | null> {
  const attributeClass = await getAttributeClass(attributeId);
  if (!attributeClass) {
    return null;
  }
  if (attributeClass.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return attributeClass;
}

export async function GET(
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const attributeClass = await fetchAndAuthorizeAttributeClass(authentication, params.attributeClassId);
    if (attributeClass) {
      return responses.successResponse(attributeClass);
    }
    return responses.notFoundResponse("Attribute Class", params.attributeClassId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const attributeClass = await fetchAndAuthorizeAttributeClass(authentication, params.attributeClassId);
    if (!attributeClass) {
      return responses.notFoundResponse("Attribute Class", params.attributeClassId);
    }
    if (attributeClass.type === "automatic") {
      return responses.badRequestResponse("Automatic Attribute Classes cannot be deleted");
    }
    const deletedAttributeClass = await deleteAttributeClass(params.attributeClassId);
    return responses.successResponse(deletedAttributeClass);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const attributeClass = await fetchAndAuthorizeAttributeClass(authentication, params.attributeClassId);
    if (!attributeClass) {
      return responses.notFoundResponse("Attribute Class", params.attributeClassId);
    }
    const attributeClassUpdate = await request.json();
    const inputValidation = ZAttributeClassUpdateInput.safeParse(attributeClassUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    const updatedAttributeClass = await updatetAttributeClass(params.attributeClassId, inputValidation.data);
    if (updatedAttributeClass) {
      return responses.successResponse(updatedAttributeClass);
    }
    return responses.internalServerErrorResponse("Some error ocured while updating action");
  } catch (error) {
    return handleErrorResponse(error);
  }
}
