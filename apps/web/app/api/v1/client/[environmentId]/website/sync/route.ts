import { getExampleSurveyTemplate } from "@/app/(app)/environments/[environmentId]/surveys/templates/templates";
import { sendFreeLimitReachedEventToPosthogBiWeekly } from "@/app/api/v1/client/[environmentId]/app/sync/lib/posthog";
import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";

import { getActionClassByEnvironmentIdAndName, getActionClasses } from "@formbricks/lib/actionClass/service";
import {
  IS_FORMBRICKS_CLOUD,
  PRICING_APPSURVEYS_FREE_RESPONSES,
  WEBAPP_URL,
} from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { createSurvey, getSurveys, transformToLegacySurvey } from "@formbricks/lib/survey/service";
import { getMonthlyTeamResponseCount, getTeamByEnvironmentId } from "@formbricks/lib/team/service";
import { isVersionGreaterThanOrEqualTo } from "@formbricks/lib/utils/version";
import { TLegacySurvey } from "@formbricks/types/LegacySurvey";
import { TJsWebsiteStateSync, ZJsWebsiteSyncInput } from "@formbricks/types/js";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";

export async function OPTIONS(): Promise<Response> {
  return responses.successResponse({}, true);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<Response> {
  try {
    const searchParams = request.nextUrl.searchParams;
    const version =
      searchParams.get("version") === "undefined" || searchParams.get("version") === null
        ? undefined
        : searchParams.get("version");
    const syncInputValidation = ZJsWebsiteSyncInput.safeParse({
      environmentId: params.environmentId,
    });

    if (!syncInputValidation.success) {
      return responses.badRequestResponse(
        "Fields are missing or incorrectly formatted",
        transformErrorToDetails(syncInputValidation.error),
        true
      );
    }

    const { environmentId } = syncInputValidation.data;

    const environment = await getEnvironment(environmentId);
    const team = await getTeamByEnvironmentId(environmentId);
    if (!team) {
      throw new Error("Team does not exist");
    }

    if (!environment) {
      throw new Error("Environment does not exist");
    }

    // check if MAU limit is reached
    let isInAppSurveyLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      // check team subscriptons

      // check inAppSurvey subscription
      const hasInAppSurveySubscription =
        team.billing.features.inAppSurvey.status &&
        ["active", "canceled"].includes(team.billing.features.inAppSurvey.status);
      const currentResponseCount = await getMonthlyTeamResponseCount(team.id);
      isInAppSurveyLimitReached =
        !hasInAppSurveySubscription && currentResponseCount >= PRICING_APPSURVEYS_FREE_RESPONSES;
      if (isInAppSurveyLimitReached) {
        await sendFreeLimitReachedEventToPosthogBiWeekly(environmentId, "inAppSurvey");
      }
    }

    if (!environment?.widgetSetupCompleted) {
      const exampleTrigger = await getActionClassByEnvironmentIdAndName(environmentId, "New Session");
      if (!exampleTrigger) {
        throw new Error("Example trigger not found");
      }
      const firstSurvey = getExampleSurveyTemplate(WEBAPP_URL, exampleTrigger);
      await createSurvey(environmentId, firstSurvey);
      await updateEnvironment(environment.id, { widgetSetupCompleted: true });
    }

    const [surveys, actionClasses, product] = await Promise.all([
      getSurveys(environmentId),
      getActionClasses(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!product) {
      throw new Error("Product not found");
    }

    // Common filter condition for selecting surveys that are in progress, are of type 'website' and have no active segment filtering.
    const filteredSurveys = surveys.filter(
      (survey) => survey.status === "inProgress" && survey.type === "website"
      // TODO: Find out if this required anymore. Most likely not.
      // && (!survey.segment || survey.segment.filters.length === 0)
    );

    // Define 'transformedSurveys' which can be an array of either TLegacySurvey or TSurvey.
    let transformedSurveys: TLegacySurvey[] | TSurvey[];

    // Backwards compatibility for versions less than 1.7.0 (no multi-language support).
    if (version && isVersionGreaterThanOrEqualTo(version, "1.7.0")) {
      // Scenario 1: Multi language supported
      // Use the surveys as they are.
      transformedSurveys = filteredSurveys;
    } else {
      // Scenario 2: Multi language not supported
      // Convert to legacy surveys with default language.
      transformedSurveys = await Promise.all(
        filteredSurveys.map((survey) => {
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
    const noCodeActionClasses = actionClasses.filter((actionClass) => actionClass.type === "noCode");

    // Create the 'state' object with surveys, noCodeActionClasses, product, and person.
    const state: TJsWebsiteStateSync = {
      surveys: isInAppSurveyLimitReached ? [] : transformedSurveys,
      noCodeActionClasses,
      ...(version && isVersionGreaterThanOrEqualTo(version, "2.0.0") && { actionClasses }),
      product: updatedProduct,
    };

    return responses.successResponse(
      { ...state },
      true,
      "public, s-maxage=600, max-age=840, stale-while-revalidate=600, stale-if-error=600"
    );
  } catch (error) {
    console.error(error);
    return responses.internalServerErrorResponse(`Unable to complete response: ${error.message}`, true);
  }
}
