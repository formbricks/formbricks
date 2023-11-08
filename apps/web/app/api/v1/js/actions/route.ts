import { transformErrorToDetails } from "@/app/lib/api/validator";
import { responses } from "@/app/lib/api/response";
import { createAction } from "@formbricks/lib/action/service";
import { ZActionInput } from "@formbricks/types/actions";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZActionInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, name, properties, personId } = inputValidation.data;

    if (personId === "anonymous") {
      return responses.successResponse({}, true);
    }

    // hotfix: don't create action for "Exit Intent (Desktop)", 50% Scroll events
    if (["Exit Intent (Desktop)", "50% Scroll"].includes(name)) {
      return responses.successResponse({}, true);
    }

    if (!personId.length && name === "New Session") {
      return responses.successResponse({}, true);
    }

    await createAction({
      environmentId,
      personId,
      name,
      properties,
    });

    return responses.successResponse({}, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
