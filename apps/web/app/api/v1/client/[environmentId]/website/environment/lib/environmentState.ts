import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { getActionClasses } from "@formbricks/lib/actionClass/service";
import { cache } from "@formbricks/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment, updateEnvironment } from "@formbricks/lib/environment/service";
import { organizationCache } from "@formbricks/lib/organization/cache";
import {
  getMonthlyOrganizationResponseCount,
  getOrganizationByEnvironmentId,
} from "@formbricks/lib/organization/service";
import {
  capturePosthogEnvironmentEvent,
  sendPlanLimitsReachedEventToPosthogWeekly,
} from "@formbricks/lib/posthogServer";
import { productCache } from "@formbricks/lib/product/cache";
import { getProductByEnvironmentId } from "@formbricks/lib/product/service";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSurveys } from "@formbricks/lib/survey/service";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsEnvironmentState } from "@formbricks/types/js";

/**
 * Get the environment state
 * @param environmentId
 * @returns The environment state
 * @throws ResourceNotFoundError if the organization, environment or product is not found
 * @throws InvalidInputError if the product channel is not website
 */
export const getEnvironmentState = async (environmentId: string): Promise<TJsEnvironmentState["data"]> =>
  cache(
    async () => {
      const [environment, organization, product] = await Promise.all([
        getEnvironment(environmentId),
        getOrganizationByEnvironmentId(environmentId),
        getProductByEnvironmentId(environmentId),
      ]);

      if (!organization) {
        throw new ResourceNotFoundError("organization", environmentId);
      }

      if (!environment) {
        throw new ResourceNotFoundError("environment", environmentId);
      }

      if (!product) {
        throw new ResourceNotFoundError("product", environmentId);
      }

      if (product.config.channel && product.config.channel !== "website") {
        throw new InvalidInputError("Product channel is not website");
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
      );

      const updatedProduct: any = {
        ...product,
        brandColor: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor,
        ...(product.styling.highlightBorderColor?.light && {
          highlightBorderColor: product.styling.highlightBorderColor.light,
        }),
      };

      const state: TJsEnvironmentState["data"] = {
        surveys: filteredSurveys,
        actionClasses,
        product: updatedProduct,
      };

      return state;
    },
    [`environmentState-website-${environmentId}`],
    {
      ...(IS_FORMBRICKS_CLOUD && { revalidate: 24 * 60 * 60 }),
      tags: [
        environmentCache.tag.byId(environmentId),
        organizationCache.tag.byEnvironmentId(environmentId),
        productCache.tag.byEnvironmentId(environmentId),
        surveyCache.tag.byEnvironmentId(environmentId),
        actionClassCache.tag.byEnvironmentId(environmentId),
      ],
    }
  )();
