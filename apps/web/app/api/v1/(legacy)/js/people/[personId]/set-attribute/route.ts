import { getUpdatedState } from "@/app/api/v1/(legacy)/js/sync/lib/sync";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextResponse } from "next/server";

import { createAttributeClass, getAttributeClassByName } from "@formbricks/lib/attributeClass/service";
import { personCache } from "@formbricks/lib/person/cache";
import { getPerson, updatePersonAttribute } from "@formbricks/lib/person/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { ZJsPeopleLegacyAttributeInput } from "@formbricks/types/js";
import { TPersonClient } from "@formbricks/types/people";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, { params }): Promise<NextResponse> {
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

    let attributeClass = await getAttributeClassByName(environmentId, key);

    // create new attribute class if not found
    if (attributeClass === null) {
      attributeClass = await createAttributeClass(environmentId, key, "code");
    }

    if (!attributeClass) {
      return responses.internalServerErrorResponse("Unable to create attribute class", true);
    }

    // upsert attribute (update or create)
    await updatePersonAttribute(personId, attributeClass.id, value);

    personCache.revalidate({
      id: personId,
      environmentId,
    });

    surveyCache.revalidate({
      environmentId,
    });

    const state = await getUpdatedState(environmentId, personId);

    let person: TPersonClient | null = null;
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
}
