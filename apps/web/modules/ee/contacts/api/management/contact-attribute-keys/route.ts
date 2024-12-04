import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { DatabaseError } from "@formbricks/types/errors";
import { ZContactAttributeKeyCreateInput } from "./[contactAttributeKeyId]/types/contact-attribute-keys";
import { createContactAttributeKey, getContactAttributeKeys } from "./lib/contact-attribute-keys";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    const contactAttributeKeys = await getContactAttributeKeys(authentication.environmentId);
    return responses.successResponse(contactAttributeKeys);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};

export const POST = async (request: Request): Promise<Response> => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();

    const isContactsEnabled = await getIsContactsEnabled();
    if (!isContactsEnabled) {
      return responses.forbiddenResponse("Contacts are only enabled for Enterprise Edition, please upgrade.");
    }

    let contactAttibuteKeyInput;
    try {
      contactAttibuteKeyInput = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON input: ${error}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZContactAttributeKeyCreateInput.safeParse(contactAttibuteKeyInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const contactAttributeKey = await createContactAttributeKey(
      authentication.environmentId,
      inputValidation.data.key,
      inputValidation.data.type
    );

    if (!contactAttributeKey) {
      return responses.internalServerErrorResponse("Failed creating attribute class");
    }
    return responses.successResponse(contactAttributeKey);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
