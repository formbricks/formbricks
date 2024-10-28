import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { DatabaseError } from "@formbricks/types/errors";
import { createContactAttributeKey, getContactAttributeKeys } from "./lib/contact-attribute-key";
import { ZContactAttributeKeyCreateInput } from "./types/contact-attribute-key";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
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

    let attributeClassInput;
    try {
      attributeClassInput = await request.json();
    } catch (error) {
      console.error(`Error parsing JSON input: ${error}`);
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZContactAttributeKeyCreateInput.safeParse(attributeClassInput);

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
