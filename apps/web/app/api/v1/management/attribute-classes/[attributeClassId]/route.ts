import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import {
  deleteAttributeClass,
  getAttributeClass,
  updateAttributeClass,
} from "@formbricks/lib/attributeClass/service";
import { TAttributeClass, ZAttributeClassUpdateInput } from "@formbricks/types/attribute-classes";
import { TAuthenticationApiKey } from "@formbricks/types/auth";

const fetchAndAuthorizeAttributeClass = async (
  authentication: TAuthenticationApiKey,
  attributeId: string
): Promise<TAttributeClass | null> => {
  const attributeClass = await getAttributeClass(attributeId);
  if (!attributeClass) {
    return null;
  }
  if (attributeClass.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return attributeClass;
};

export const GET = async (
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<Response> => {
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
};

export const DELETE = async (
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<Response> => {
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
};

export const PUT = async (
  request: Request,
  { params }: { params: { attributeClassId: string } }
): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const attributeClass = await fetchAndAuthorizeAttributeClass(authentication, params.attributeClassId);
    if (!attributeClass) {
      return responses.notFoundResponse("Attribute Class", params.attributeClassId);
    }

    let attributeClassUpdate;
    try {
      attributeClassUpdate = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON input: ${error}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZAttributeClassUpdateInput.safeParse(attributeClassUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    const updatedAttributeClass = await updateAttributeClass(params.attributeClassId, inputValidation.data);
    if (updatedAttributeClass) {
      return responses.successResponse(updatedAttributeClass);
    }
    return responses.internalServerErrorResponse("Some error ocured while updating action");
  } catch (error) {
    return handleErrorResponse(error);
  }
};
