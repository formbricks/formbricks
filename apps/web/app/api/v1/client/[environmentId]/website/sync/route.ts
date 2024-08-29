import { responses } from "@/app/lib/api/response";
import { transformErrorToDetails } from "@/app/lib/api/validator";
import { NextRequest } from "next/server";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@formbricks/lib/posthogServer";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { getSurveys } from "@formbricks/lib/survey/service";
import { TJsWebsiteStateSync, ZJsWebsiteSyncInput } from "@formbricks/types/js";
import { TSurvey } from "@formbricks/types/surveys/types";

export const OPTIONS = async (): Promise<Response> => {
  return responses.successResponse({}, true);
};

export const GET = async (
  _: NextRequest,
  { params }: { params: { environmentId: string } }
): Promise<Response> => {
  try {
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

    const [environment, organization, product] = await Promise.all([
      getEnvironment(environmentId),
      getOrganizationByEnvironmentId(environmentId),
      getProductByEnvironmentId(environmentId),
    ]);

    if (!organization) {
      throw new Error("Organization does not exist");
    }

    if (!environment) {
      throw new Error("Environment does not exist");
    }

    if (!product) {
      throw new Error("Product not found");
    }

    if (product.config.channel && product.config.channel !== "website") {
      return responses.forbiddenResponse("Product channel is not website", true);
    }

    // check if response limit is reached
    let isWebsiteSurveyResponseLimitReached = false;
    if (IS_FORMBRICKS_CLOUD) {
      const currentResponseCount = await getMonthlyOrganizationResponseCount(organization.id);
      const monthlyResponseLimit = organization.billing.limits.monthly.responses;

      isWebsiteSurveyResponseLimitReached =
        monthlyResponseLimit !== null && currentResponseCount >= monthlyResponseLimit;

      if (isWebsiteSurveyResponseLimitReached) {
        try {
          await sendPlanLimitsReachedEventToPosthogWeekly(environmentId, {
            plan: organization.billing.plan,
            limits: { monthly: { responses: monthlyResponseLimit, miu: null } },
          });
        } catch (error) {
          console.error(`Error sending plan limits reached event to Posthog: ${error}`);
        }
      }
    }

    // temporary remove the example survey creation to avoid caching issue with multiple example surveys
    /* if (!environment?.websiteSetupCompleted) {
      const exampleTrigger = await getActionClassByEnvironmentIdAndName(environmentId, "New Session");
      if (!exampleTrigger) {
        throw new Error("Example trigger not found");
      }
      const firstSurvey = getExampleWebsiteSurveyTemplate(WEBAPP_URL, exampleTrigger);
      await createSurvey(environmentId, firstSurvey);
      await updateEnvironment(environment.id, { websiteSetupCompleted: true });
    } */

    if (!environment?.websiteSetupCompleted) {
      await Promise.all([
        updateEnvironment(environment.id, { websiteSetupCompleted: true }),
        capturePosthogEnvironmentEvent(environmentId, "website setup completed"),
      ]);
    }

    const [surveys, actionClasses] = await Promise.all([
      getSurveys(environmentId),
      getActionClasses(environmentId),
    ]);

    // Common filter condition for selecting surveys that are in progress, are of type 'website' and have no active segment filtering.
    const filteredSurveys = surveys.filter(
      (survey) => survey.status === "inProgress" && survey.type === "website"
      // TODO: Find out if this required anymore. Most likely not.
      // && (!survey.segment || survey.segment.filters.length === 0)
    );

    const updatedProduct: any = {
      ...product,
      brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
      ...(product.styling.highlightBorderColor?.light && {
        highlightBorderColor: product.styling.highlightBorderColor.light,
      }),
    };

    // Define 'transformedSurveys' which can be an array of either TLegacySurvey or TSurvey.
    let transformedSurveys: TSurvey[] = filteredSurveys;
    let state: TJsWebsiteStateSync = {
      surveys: !isWebsiteSurveyResponseLimitReached ? transformedSurveys : [],
      actionClasses,
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
};
