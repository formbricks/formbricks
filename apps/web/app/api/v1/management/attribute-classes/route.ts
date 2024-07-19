import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { createAttributeClass, getAttributeClasses } from "@formbricks/lib/attributeClass/service";
import { TAttributeClass, ZAttributeClassInput } from "@formbricks/types/attribute-classes";
import { DatabaseError } from "@formbricks/types/errors";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const atributeClasses: TAttributeClass[] = await getAttributeClasses(authentication.environmentId!);
    return responses.successResponse(atributeClasses);
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

    const inputValidation = ZAttributeClassInput.safeParse(attributeClassInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const attributeClass: TAttributeClass | null = await createAttributeClass(
      authentication.environmentId,
      inputValidation.data.name,
      inputValidation.data.type
    );
    if (!attributeClass) {
      return responses.internalServerErrorResponse("Failed creating attribute class");
    }
    return responses.successResponse(attributeClass);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
