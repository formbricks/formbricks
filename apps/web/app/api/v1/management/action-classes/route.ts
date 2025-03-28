import { authenticateRequest } from "@/app/api/v1/auth";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { createActionClass, getActionClasses } from "@formbricks/lib/actionClass/service";
import { logger } from "@formbricks/logger";
import { TActionClass, ZActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";

export const GET = async (request: Request) => {
  try {
    const authentication = await authenticateRequest(request);
    if (!authentication) return responses.notAuthenticatedResponse();
    const actionClasses: TActionClass[] = await getActionClasses(authentication.environmentId!);
    return responses.successResponse(actionClasses);
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

    let actionClassInput;
    try {
      actionClassInput = await request.json();
    } catch (error) {
      logger.error({ error, url: request.url }, "Error parsing JSON input");
      return responses.badRequestResponse("Malformed JSON input, please check your request body");
    }

    const inputValidation = ZActionClassInput.safeParse(actionClassInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const actionClass: TActionClass = await createActionClass(
      authentication.environmentId!,
      inputValidation.data
    );
    return responses.successResponse(actionClass);
  } catch (error) {
    if (error instanceof DatabaseError) {
      return responses.badRequestResponse(error.message);
    }
    throw error;
  }
};
