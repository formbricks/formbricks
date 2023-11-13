import { getUpdatedState } from "@/app/api/v1/client/[environmentId]/in-app/sync/lib/state";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
import { ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const jsonInput = await req.json();

    // validate using zod
    const inputValidation = ZJsPeopleUserIdInput.safeParse(jsonInput);

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, userId } = inputValidation.data;

    const personWithUserId = await getOrCreatePersonByUserId(userId, environmentId);

    const state = await getUpdatedState(environmentId, personWithUserId.id);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
