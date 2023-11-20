import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getPersonByUserId, updatePerson } from "@formbricks/lib/person/service";
import { ZPersonUpdateInput } from "@formbricks/types/people";
import { NextResponse } from "next/server";

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

    const person = await getPersonByUserId(userId, environmentId);

    if (!person) {
      return responses.notFoundResponse("PersonByUserId", userId, true);
    }

    const updatedPerson = await updatePerson(person.id, inputValidation.data);

    return responses.successResponse(updatedPerson, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete request: ${error.message}`, true);
  }
}
