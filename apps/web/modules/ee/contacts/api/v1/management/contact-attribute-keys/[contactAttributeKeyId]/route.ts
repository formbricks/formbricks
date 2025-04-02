import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { hasPermission } from "@/modules/organization/settings/api-keys/lib/utils";
import { logger } from "@formbricks/logger";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./lib/contact-attribute-key";
import { ZContactAttributeKeyUpdateInput } from "./types/contact-attribute-keys";

async function fetchAndAuthorizeContactAttributeKey(
  attributeKeyId: string,
  authentication: TAuthenticationApiKey,
  requiredPermission: "GET" | "PUT" | "DELETE"
) {
  const attributeKey = await getContactAttributeKey(attributeKeyId);
  if (!attributeKey) {
    return { error: responses.notFoundResponse("Attribute Key", attributeKeyId) };
  }

  if (!hasPermission(authentication.environmentPermissions, attributeKey.environmentId, requiredPermission)) {
    return { error: responses.unauthorizedResponse() };
  }

  return { attributeKey };
}
export const GET = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeContactAttributeKey(
      params.contactAttributeKeyId,
      authentication,
      "GET"
    );
    if (result.error) return result.error;

    return responses.successResponse(result.attributeKey);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Contacts are only enabled for Enterprise Edition, please upgrade."
    ) {
      return responses.forbiddenResponse(error.message);
    }
    return handleErrorResponse(error);
  }
};

export const DELETE = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeContactAttributeKey(
      params.contactAttributeKeyId,
      authentication,
      "DELETE"
    );

    if (result.error) return result.error;
    if (result.attributeKey.type === "default") {
      return responses.badRequestResponse("Default Contact Attribute Keys cannot be deleted");
    }
    const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);
    return responses.successResponse(deletedContactAttributeKey);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Contacts are only enabled for Enterprise Edition, please upgrade."
    ) {
      return responses.forbiddenResponse(error.message);
    }
    return handleErrorResponse(error);
  }
};

export const PUT = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const result = await fetchAndAuthorizeContactAttributeKey(
      params.contactAttributeKeyId,
      authentication,
      "PUT"
    );
    if (result.error) return result.error;

    let contactAttributeKeyUpdate;
    try {
      contactAttributeKeyUpdate = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON input");
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZContactAttributeKeyUpdateInput.safeParse(contactAttributeKeyUpdate);
    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error)
      );
    }
    const updatedAttributeClass = await updateContactAttributeKey(
      params.contactAttributeKeyId,
      inputValidation.data
    );
    if (updatedAttributeClass) {
      return responses.successResponse(updatedAttributeClass);
    }
    return responses.internalServerErrorResponse("Some error ocured while updating action");
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Contacts are only enabled for Enterprise Edition, please upgrade."
    ) {
      return responses.forbiddenResponse(error.message);
    }
    return handleErrorResponse(error);
  }
};
