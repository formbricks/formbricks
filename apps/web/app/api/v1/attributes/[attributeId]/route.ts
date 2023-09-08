import { responses } from "@/lib/api/response";
import { DatabaseError, InvalidInputError, ResourceNotFoundError } from "@formbricks/errors";
import { NextResponse } from "next/server";
import {
  deleteAttributeClass,
  getAttributeClass,
  updatetAttributeClass,
} from "@formbricks/lib/services/attributeClass";
import { TAttributeClass, ZAttributeClassUpdateInput } from "@formbricks/types/v1/attributeClasses";
import { transformErrorToDetails } from "@/lib/api/validator";
import { hasUserEnvironmentAccess } from "@/lib/api/apiHelper";
import { authenticateRequest } from "@/app/api/v1/auth";

async function fetchAndValidateAttribute(
  authentication: any,
  attributeId: string
): Promise<TAttributeClass | null> {
  const attribute = await getAttributeClass(attributeId);
  if (!attribute) {
    return null;
  }
  if (!(await canUserAccessAttribute(authentication, attribute))) {
    throw new Error("Unauthorized");
  }
  return attribute;
}

const canUserAccessAttribute = async (authentication: any, attribute: TAttributeClass): Promise<boolean> => {
  if (!authentication) return false;

  if (authentication.type === "session") {
    return await hasUserEnvironmentAccess(authentication.session.user, attribute.environmentId);
  } else if (authentication.type === "apiKey") {
    return attribute.environmentId === authentication.environmentId;
  } else {
    throw Error("Unknown authentication type");
  }
};

export async function GET(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const attribute = await fetchAndValidateAttribute(authentication, params.attributeId);
    if (attribute) {
      return responses.successResponse(attribute);
    }
    return responses.notFoundResponse("Attribute", params.attributeId);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const attribute = await fetchAndValidateAttribute(authentication, params.attributeId);
    if (!attribute) {
      return responses.notFoundResponse("Survey", params.attributeId);
    }
    const deletedAttribute = await deleteAttributeClass(params.attributeId);
    return responses.successResponse(deletedAttribute);
  } catch (error) {
    return handleErrorResponse(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { attributeId: string } }
): Promise<NextResponse> {
  try {
    const authentication = await authenticateRequest(request);
    const attribute = await fetchAndValidateAttribute(authentication, params.attributeId);
    if (!attribute) {
      return responses.notFoundResponse("Survey", params.attributeId);
    }
    const attributeCLassUpdate = await request.json();
    const inputValidation = ZAttributeClassUpdateInput.safeParse(attributeCLassUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    const updatedAttribute = await updatetAttributeClass(params.attributeId, inputValidation.data);
    if (updatedAttribute) {
      return responses.successResponse(updatedAttribute);
    }
    return responses.internalServerErrorResponse("Some error ocured while updating action");
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
