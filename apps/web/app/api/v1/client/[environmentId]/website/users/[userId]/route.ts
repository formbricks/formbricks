import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { getDisplaysByPersonId } from "@formbricks/lib/display/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPersonByUserId } from "@formbricks/lib/person/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { TJsWebsitePersonState, ZJsWebsiteIdentifyInput } from "@formbricks/types/js";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  request: NextRequest,
  { params }: { params: { environmentId: string; userId: string } }
): Promise<Response> => {
  try {
    const { environmentId, userId } = params;

    // Validate input
    const syncInputValidation = ZJsWebsiteIdentifyInput.safeParse({
      environmentId,
      userId,
    });
    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const environment = await getEnvironment(environmentId);

    if (!environment) {
      return responses.notFoundResponse("Environment", environmentId, true);
    }

    // Check if the person exists
    // If the person exists, return the persons's state
    // If the person does not exist, return an empty state
    const person = await getPersonByUserId(environmentId, userId);

    if (!person) {
      // If the person does not exist, return an empty state
      return responses.successResponse(
        {},
        true,
        "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
      );
    }

    const personResponses = await getResponsesByPersonId(person.id);
    const personDisplays = await getDisplaysByPersonId(person.id);

    // If the person exists, return the persons's state
    const userState: TJsWebsitePersonState = {
      userId: person.userId,
      displays: personDisplays?.map((display) => display.surveyId) ?? [],
      responses: personResponses?.map((response) => response.surveyId) ?? [],
      lastDisplayAt: personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
        .createdAt,
    };

    return responses.successResponse(
      userState,
      true,
      "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
};
