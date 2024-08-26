import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest, userAgent } from "next/server";
import { getAttributesByUserId } from "@formbricks/lib/attribute/service";
import { getDisplaysByPersonId } from "@formbricks/lib/display/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import { getPersonByUserId } from "@formbricks/lib/person/service";
import { getResponsesByPersonId } from "@formbricks/lib/response/service";
import { TJsPersonState, ZJsPersonIdentifyInput } from "@formbricks/types/js";
import { getPersonSegmentIds } from "./lib/segments";

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
    const syncInputValidation = ZJsPersonIdentifyInput.safeParse({
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

    const { device } = userAgent(request);
    const deviceType = device.type === "mobile" ? "phone" : "desktop";

    const personResponses = await getResponsesByPersonId(person.id);
    const personDisplays = await getDisplaysByPersonId(person.id);
    const segments = await getPersonSegmentIds(environmentId, person, deviceType);
    const attributes = await getAttributesByUserId(environmentId, userId);

    // If the person exists, return the persons's state
    const userState: TJsPersonState = {
      expiresAt: null,
      data: {
        userId: person.userId,
        segments,
        displays: personDisplays?.map((display) => display.surveyId) ?? [],
        responses: personResponses?.map((response) => response.surveyId) ?? [],
        attributes,
        lastDisplayAt:
          personDisplays.length > 0
            ? personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
            : null,
      },
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
