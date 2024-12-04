import { authenticateRequest, handleErrorResponse } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { TAuthenticationApiKey } from "@formbricks/types/auth";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import {
  deleteContactAttributeKey,
  getContactAttributeKey,
  updateContactAttributeKey,
} from "./lib/contact-attribute-key";
import { ZContactAttributeKeyUpdateInput } from "./types/contact-attribute-keys";

const fetchAndAuthorizeContactAttributeKey = async (
  authentication: TAuthenticationApiKey,
  contactAttributeKeyId: string
): Promise<TContactAttributeKey | null> => {
  const contactAttributeKey = await getContactAttributeKey(contactAttributeKeyId);
  if (!contactAttributeKey) {
    return null;
  }
  if (contactAttributeKey.environmentId !== authentication.environmentId) {
    throw new Error("Unauthorized");
  }
  return contactAttributeKey;
};

export const GET = async (
  request: Request,
  { params: paramsPromise }: { params: Promise<{ contactAttributeKeyId: string }> }
): Promise<Response> => {
  try {
    const params = await paramsPromise;
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contactAttributeKey = await fetchAndAuthorizeContactAttributeKey(
      authentication,
      params.contactAttributeKeyId
    );
    if (contactAttributeKey) {
      return responses.successResponse(contactAttributeKey);
    }
    return responses.notFoundResponse("Contact Attribute Key", params.contactAttributeKeyId);
  } catch (error) {
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

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contactAttributeKey = await fetchAndAuthorizeContactAttributeKey(
      authentication,
      params.contactAttributeKeyId
    );
    if (!contactAttributeKey) {
      return responses.notFoundResponse("Contact Attribute Key", params.contactAttributeKeyId);
    }
    if (contactAttributeKey.type === "default") {
      return responses.badRequestResponse("Default Contact Attribute Keys cannot be deleted");
    }
    const deletedContactAttributeKey = await deleteContactAttributeKey(params.contactAttributeKeyId);
    return responses.successResponse(deletedContactAttributeKey);
  } catch (error) {
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

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contactAttributeKey = await fetchAndAuthorizeContactAttributeKey(
      authentication,
      params.contactAttributeKeyId
    );
    if (!contactAttributeKey) {
      return responses.notFoundResponse("Contact Attribute Key", params.contactAttributeKeyId);
    }

    let contactAttributeKeyUpdate;
    try {
      contactAttributeKeyUpdate = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON input: ${error}`);
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
    return handleErrorResponse(error);
  }
};
