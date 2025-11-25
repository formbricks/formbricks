import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { TJsEnvironmentState } from "@formbricks/types/js";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD, IS_RECAPTCHA_CONFIGURED, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { getMonthlyOrganizationResponseCount } from "@/lib/organization/service";
import { getEnvironmentStateData } from "./data";

/**
 * Optimized environment state fetcher using new caching approach
 * Uses withCache for Redis-backed caching with graceful fallback
 * Single database query via optimized data service
 *
 * @param environmentId - The environment ID to fetch state for
 * @returns The environment state
 * @throws ResourceNotFoundError if environment, organization, or project not found
 */
export const getEnvironmentState = async (
  environmentId: string
): Promise<{ data: TJsEnvironmentState["data"] }> => {
  return cache.withCache(
    async () => {
      // Single optimized database call replacing multiple service calls
      const { environment, organization, surveys, actionClasses } =
        await getEnvironmentStateData(environmentId);

      // Handle app setup completion update if needed
      // This is a one-time setup flag that can tolerate TTL-based cache expiration
      if (!environment.appSetupCompleted) {
        await prisma.environment.update({
          where: { id: environmentId },
          data: { appSetupCompleted: true },
        });
      }

      // Check monthly response limits for Formbricks Cloud
      let isMonthlyResponsesLimitReached = false;
      if (IS_FORMBRICKS_CLOUD) {
        const monthlyResponseLimit = organization.billing.limits.monthly.responses;
        const currentResponseCount = await getMonthlyOrganizationResponseCount(organization.id);
        isMonthlyResponsesLimitReached =
          monthlyResponseLimit !== null && currentResponseCount >= monthlyResponseLimit;
      }

      // Build the response data
      const data: TJsEnvironmentState["data"] = {
        surveys: !isMonthlyResponsesLimitReached ? surveys : [],
        actionClasses,
        project: environment.project,
        ...(IS_RECAPTCHA_CONFIGURED ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY } : {}),
      };

      return { data };
    },
    createCacheKey.environment.state(environmentId),
    60 * 1000 // 1 minutes in milliseconds
  );
};
