import { getUpdatedState } from "@/app/api/v1/(legacy)/js/sync/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";

import { updateAttributes } from "@formbricks/lib/attribute/service";
import { personCache } from "@formbricks/lib/person/cache";
import { getPerson } from "@formbricks/lib/person/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { ZJsPeopleLegacyAttributeInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const POST = async (req: Request, { params }): Promise<Response> => {
  try {
    const { personId } = params;

    if (!personId || personId === "legacy") {
      return responses.internalServerErrorResponse("setAttribute requires an identified user", true);
    }

    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsPeopleLegacyAttributeInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, key, value } = inputValidation.data;

    const existingPerson = await getPerson(personId);

    if (!existingPerson) {
      return responses.notFoundResponse("Person", personId, true);
    }

    await updateAttributes(personId, { [key]: value });

    personCache.revalidate({
      id: personId,
      environmentId,
    });

    surveyCache.revalidate({
      environmentId,
    });

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
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
};
