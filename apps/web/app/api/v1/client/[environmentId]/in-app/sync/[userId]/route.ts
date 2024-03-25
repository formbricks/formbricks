import { sendFreeLimitReachedEventToPosthogBiWeekly } from "@/app/api/v1/client/[environmentId]/in-app/sync/lib/posthog";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest, userAgent } from "next/server";

import { getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  PRICING_USERTARGETING_FREE_MTU,
} from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { createPerson, getIsPersonMonthlyActive, getPersonByUserId } from "@formbricks/lib/person/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSyncSurveys, transformToLegacySurvey } from "@formbricks/lib/survey/service";
import {
  getMonthlyActiveTeamPeopleCount,
  getMonthlyTeamResponseCount,
  getTeamByEnvironmentId,
} from "@formbricks/lib/team/service";
import { isVersionGreaterThanOrEqualTo } from "@formbricks/lib/utils/version";
import { TLegacySurvey } from "@formbricks/types/LegacySurvey";
import { TEnvironment } from "@formbricks/types/environment";
import { TJsStateSync, ZJsPeopleUserIdInput } from "@formbricks/types/js";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: {
      environmentId: string;
      userId: string;
    };
  }
): Promise<Response> {
  try {
    const { device } = userAgent(request);
    const version = request.nextUrl.searchParams.get("version");

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

    let environment: TEnvironment | null;

    // check if environment exists
    environment = await getEnvironment(environmentId);
    if (!environment) {
      throw new Error("Environment does not exist");
    }
    if (!environment?.widgetSetupCompleted) {
      await updateEnvironment(environment.id, { widgetSetupCompleted: true });
    }
    // check team subscriptons
    const team = await getTeamByEnvironmentId(environmentId);

    if (!team) {
      throw new Error("Team does not exist");
    }

    // check if MAU limit is reached
    let isMauLimitReached = false;
    let isInAppSurveyLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      // check userTargeting subscription
      const hasUserTargetingSubscription =
        team.billing.features.userTargeting.status &&
        ["active", "canceled"].includes(team.billing.features.userTargeting.status);
      const currentMau = await getMonthlyActiveTeamPeopleCount(team.id);
      isMauLimitReached = !hasUserTargetingSubscription && currentMau >= PRICING_USERTARGETING_FREE_MTU;
      // check inAppSurvey subscription
      const hasInAppSurveySubscription =
        team.billing.features.inAppSurvey.status &&
        ["active", "canceled"].includes(team.billing.features.inAppSurvey.status);
      const currentResponseCount = await getMonthlyTeamResponseCount(team.id);
      isInAppSurveyLimitReached =
        !hasInAppSurveySubscription && currentResponseCount >= PRICING_APPSURVEYS_FREE_RESPONSES;
    }

    let person = await getPersonByUserId(environmentId, userId);
    if (!isMauLimitReached) {
      // MAU limit not reached: create person if not exists
      if (!person) {
        person = await createPerson(environmentId, userId);
      }
    } else {
      // MAU limit reached: check if person has been active this month; only continue if person has been active
      await sendFreeLimitReachedEventToPosthogBiWeekly(environmentId, "userTargeting");
      const errorMessage = `Monthly Active Users limit in the current plan is reached in ${environmentId}`;
      if (!person) {
        // if it's a new person and MAU limit is reached, throw an error
        return responses.tooManyRequestsResponse(
          errorMessage,
          true,
          "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
        );
      } else {
        // check if person has been active this month
        const isPersonMonthlyActive = await getIsPersonMonthlyActive(person.id);
        if (!isPersonMonthlyActive) {
          return responses.tooManyRequestsResponse(
            errorMessage,
            true,
            "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
          );
        }
      }
    }

    if (isInAppSurveyLimitReached) {
      await sendFreeLimitReachedEventToPosthogBiWeekly(environmentId, "inAppSurvey");
    }

    const [surveys, noCodeActionClasses, product] = await Promise.all([
      getSyncSurveys(environmentId, person.id, device.type === "mobile" ? "phone" : "desktop", {
        version: version ?? undefined,
      }),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }
    const languageAttribute = person.attributes.language;
    const isLanguageAvailable = Boolean(languageAttribute);

    const personData = version
      ? {
          ...(isLanguageAvailable && { attributes: { language: languageAttribute } }),
        }
      : {
          id: person.id,
          userId: person.userId,
          ...(isLanguageAvailable && { attributes: { language: languageAttribute } }),
        };

    // Define 'transformedSurveys' which can be an array of either TLegacySurvey or TSurvey.
    let transformedSurveys: TLegacySurvey[] | TSurvey[];

    // Backwards compatibility for versions less than 1.7.0 (no multi-language support).
    if (version && isVersionGreaterThanOrEqualTo(version, "1.7.0")) {
      // Scenario 1: Multi language supported
      // Use the surveys as they are.
      transformedSurveys = surveys;
    } else {
      // Scenario 2: Multi language not supported
      // Convert to legacy surveys with default language.
      transformedSurveys = await Promise.all(
        surveys.map((survey) => {
          const languageCode = "default";
          return transformToLegacySurvey(survey, languageCode);
        })
      );
    }

    const updatedProduct: TProduct = {
      ...product,
      brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
      ...(product.styling.highlightBorderColor?.light && {
        highlightBorderColor: product.styling.highlightBorderColor.light,
      }),
    };

    // return state
    const state: TJsStateSync = {
      person: personData,
      surveys: !isInAppSurveyLimitReached ? transformedSurveys : [],
      noCodeActionClasses: noCodeActionClasses.filter((actionClass) => actionClass.type === "noCode"),
      product: updatedProduct,
    };

    return responses.successResponse(
      { ...state },
      true,
      "public, s-maxage=100, max-age=110, stale-while-revalidate=100, stale-if-error=100"
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse("Unable to handle the request: " + error.message, true);
  }
}
