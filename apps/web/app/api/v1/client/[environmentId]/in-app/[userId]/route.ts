import { getUpdatedState } from "@formbricks/lib/sync/service";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { getDisplaysByPersonId, updateDisplay } from "@formbricks/lib/display/service";
import { personCache } from "@formbricks/lib/person/cache";
import { getOrCreatePersonByUserId } from "@formbricks/lib/person/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { NextResponse } from "next/server";

export async function OPTIONS(): Promise<NextResponse> {
  return responses.successResponse({}, true);
}

export async function GET(
  _: Request,
  {
    params,
  }: {
    params: {
      environmentId: string;
      userId: string;
    };
  }
): Promise<NextResponse> {
  try {
    // validate using zod
    const inputValidation = ZJsPeopleUserIdInput.safeParse({
      environmentId: params.environmentId,
      userId: params.userId,
    });

    if (!inputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(inputValidation.error),
        true
      );
    }

    const { environmentId, userId } = inputValidation.data;
    const person = await getOrCreatePersonByUserId(userId, environmentId);

    if (!person) {
      return responses.badRequestResponse("Fields are missing or incorrectly formatted");
    }

    const displays = await getDisplaysByPersonId(person.id);
    await Promise.all(displays.map((display) => updateDisplay(display.id, { personId: person.id })));

    personCache.revalidate({
      id: person.id,
      environmentId: environmentId,
    });

    surveyCache.revalidate({
      environmentId,
    });

    const state = await getUpdatedState(environmentId, person.id);

    return responses.successResponse({ ...state }, true);
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
