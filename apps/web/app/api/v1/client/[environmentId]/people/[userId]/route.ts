import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextResponse } from "next/server";

import { createPerson, getPersonByUserId, updatePerson } from "@formbricks/lib/person/service";
import { ZPersonUpdateInput } from "@formbricks/types/people";

interface Context {
  params: {
    userId: string;
    environmentId: string;
  };
}

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request, context: Context): Promise<NextResponse> {
  try {
    const { userId, environmentId } = context.params;
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZPersonUpdateInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    let person = await getPersonByUserId(environmentId, userId);

    if (!person) {
      // return responses.notFoundResponse("PersonByUserId", userId, true);
      // HOTFIX: create person if not found to work around caching issue
      person = await createPerson(environmentId, userId);
    }

    await updatePerson(person.id, inputValidation.data);

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
}
