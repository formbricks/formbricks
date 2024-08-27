import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest, userAgent } from "next/server";
import { getAttributesByUserId } from "@formbricks/lib/attribute/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getDisplaysByPersonId } from "@formbricks/lib/display/service";
import { getEnvironment } from "@formbricks/lib/environment/service";
import {
  getMonthlyActiveOrganizationPeopleCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import { createPerson, getIsPersonMonthlyActive, getPersonByUserId } from "@formbricks/lib/person/service";
import { sendPlanLimitsReachedEventToPosthogWeekly } from "@formbricks/lib/posthogServer";
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

    const organization = await getOrganizationByEnvironmentId(environmentId);

    if (!organization) {
      return responses.notFoundResponse("Organization", environmentId, true);
    }

    let isMauLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      const currentMau = await getMonthlyActiveOrganizationPeopleCount(organization.id);
      const monthlyMiuLimit = organization.billing.limits.monthly.miu;

      isMauLimitReached = monthlyMiuLimit !== null && currentMau >= monthlyMiuLimit;
    }

    let person = await getPersonByUserId(environmentId, userId);

    if (isMauLimitReached) {
      // MAU limit reached: check if person has been active this month; only continue if person has been active

      try {
        await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
          plan: organization.billing.plan,
          limits: {
            monthly: {
              miu: organization.billing.limits.monthly.miu,
              responses: organization.billing.limits.monthly.responses,
            },
          },
        });
      } catch (err) {
        console.error(`Error sending plan limits reached event to Posthog: ${err}`);
      }

      const errorMessage = `Monthly Active Users limit in the current plan is reached in ${environmentId}`;
      if (!person) {
        // if it's a new person and MAU limit is reached, throw an error
        return responses.tooManyRequestsResponse(
          errorMessage,
          true,
          "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
        );
      }

      // check if person has been active this month
      const isPersonMonthlyActive = await getIsPersonMonthlyActive(person.id);
      if (!isPersonMonthlyActive) {
        return responses.tooManyRequestsResponse(
          errorMessage,
          true,
          "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
        );
      }
    } else {
      // MAU limit not reached: create person if not exists
      if (!person) {
        person = await createPerson(environmentId, userId);
      }
    }

    // Check if the person exists
    // If the person exists, return the persons's state
    // If the person does not exist, return an empty state
    // const person = await getPersonByUserId(environmentId, userId);

    // if (!person) {
    //   // If the person does not exist, return an empty state
    //   return responses.successResponse(
    //     {},
    //     true,
    //     "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
    //   );
    // }

    const { device } = userAgent(request);
    const deviceType = device.type === "mobile" ? "phone" : "desktop";

    const personResponses = await getResponsesByPersonId(person.id);
    const personDisplays = await getDisplaysByPersonId(person.id);
    const segments = await getPersonSegmentIds(environmentId, person, deviceType);
    const attributes = await getAttributesByUserId(environmentId, userId);

    // If the person exists, return the persons's state
    const userState: TJsPersonState["data"] = {
      userId: person.userId,
      segments,
      displays: personDisplays?.map((display) => display.surveyId) ?? [],
      responses: personResponses?.map((response) => response.surveyId) ?? [],
      attributes,
      lastDisplayAt:
        personDisplays.length > 0
          ? personDisplays.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0].createdAt
          : null,
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
