import { getUpdatedState } from "@/app/api/v1/(legacy)/js/sync/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

import { ZJsSyncLegacyInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (req: Request): Promise<Response> => {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsSyncLegacyInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, personId } = inputValidation.data;

    const state = await getUpdatedState(environmentId, personId);

    let person: { id: string; userId: string } | null = null;
    if (state.person && "id" in state.person && "userId" in state.person) {
      person = {
        id: state.person.id,
        userId: state.person.userId,
      };
    }

    return responses.successResponse({ ...state, person }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
};
