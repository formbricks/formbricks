import { getUpdatedState } from "@/app/api/v1/js/sync/lib/sync";
import { responses } from "@/lib/api/response";
import { transformErrorToDetails } from "@/lib/api/validator";
import { createAttributeClass, getAttributeClassByNameCached } from "@formbricks/lib/attributeClass/service";
import { getPersonCached, updatePersonAttribute } from "@formbricks/lib/person/service";
import { ZJsPeopleAttributeInput } from "@formbricks/types/v1/js";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, { params }): Promise<NextResponse> {
  try {
    const { personId } = params;
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsPeopleAttributeInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, sessionId, key, value } = inputValidation.data;

    const existingPerson = await getPersonCached(personId);

    if (!existingPerson) {
      return responses.notFoundResponse("Person", personId, true);
    }

    let attributeClass = await getAttributeClassByNameCached(environmentId, key);

    // create new attribute class if not found
    if (attributeClass === null) {
      attributeClass = await createAttributeClass(environmentId, key, "code");
    }

    if (!attributeClass) {
      return responses.internalServerErrorResponse("Unable to create attribute class", true);
    }

    // upsert attribute (update or create)
    updatePersonAttribute(personId, attributeClass.id, value);

    const state = await getUpdatedState(environmentId, personId, sessionId);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
}
