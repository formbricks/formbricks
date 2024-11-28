import { prisma } from "@formbricks/database";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { getActionClassesForEnvironmentState } from "@formbricks/lib/actionClass/service";
import { cache } from "@formbricks/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { environmentCache } from "@formbricks/lib/environment/cache";
import { getEnvironment } from "@formbricks/lib/environment/service";
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
import { getProductForEnvironmentState } from "@formbricks/lib/product/service";
import { surveyCache } from "@formbricks/lib/survey/cache";
import { getSurveysForEnvironmentState } from "@formbricks/lib/survey/service";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { TJsEnvironmentState } from "@formbricks/types/js";

/**
 *
 * @param environmentId
 * @returns The environment state
 * @throws ResourceNotFoundError if the environment or organization does not exist
 */
export const getEnvironmentState = async (
  environmentId: string
): Promise<{ state: TJsEnvironmentState["data"]; revalidateEnvironment?: boolean }> =>
  cache(
    async () => {
      let revalidateEnvironment = false;
      const [environment, organization, product] = await Promise.all([
        getEnvironment(environmentId),
        getOrganizationByEnvironmentId(environmentId),
        getProductForEnvironmentState(environmentId),
      ]);

      if (!environment) {
        throw new ResourceNotFoundError("environment", environmentId);
      }

      if (!organization) {
        throw new ResourceNotFoundError("organization", null);
      }

      if (!product) {
        throw new ResourceNotFoundError("product", null);
      }

      if (!environment.appSetupCompleted) {
        await Promise.all([
          prisma.environment.update({
            where: {
              id: environmentId,
            },
            data: { appSetupCompleted: true },
          }),
          capturePosthogEnvironmentEvent(environmentId, "app setup completed"),
        ]);

        revalidateEnvironment = true;
      }

      // check if MAU limit is reached
      let isMonthlyResponsesLimitReached = false;

      if (IS_FORMBRICKS_CLOUD) {
        const monthlyResponseLimit = organization.billing.limits.monthly.responses;

        const currentResponseCount = await getMonthlyOrganizationResponseCount(organization.id);
        isMonthlyResponsesLimitReached =
          monthlyResponseLimit !== null && currentResponseCount >= monthlyResponseLimit;
      }

      if (isMonthlyResponsesLimitReached) {
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
      }

      const [surveys, actionClasses] = await Promise.all([
        getSurveysForEnvironmentState(environmentId),
        getActionClassesForEnvironmentState(environmentId),
      ]);

      const filteredSurveys = surveys.filter(
        (survey) => survey.type === "app" && survey.status === "inProgress"
      );

      const state: TJsEnvironmentState["data"] = {
        surveys: !isMonthlyResponsesLimitReached ? filteredSurveys : [],
        actionClasses,
        product,
      };

      return {
        state,
        revalidateEnvironment,
      };
    },
    [`environmentState-${environmentId}`],
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
