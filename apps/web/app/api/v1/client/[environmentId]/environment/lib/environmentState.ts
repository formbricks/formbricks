import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { TJsEnvironmentState } from "@formbricks/types/js";
import { cache } from "@/lib/cache";
import { IS_RECAPTCHA_CONFIGURED, POSTHOG_KEY, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
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
      const { environment, surveys, actionClasses } = await getEnvironmentStateData(environmentId);

      // Handle app setup completion update if needed
      // This is a one-time setup flag that can tolerate TTL-based cache expiration
      if (!environment.appSetupCompleted) {
        await prisma.environment.update({
          where: { id: environmentId },
          data: { appSetupCompleted: true },
        });

        if (POSTHOG_KEY) {
          const workspaceId = environment.project.id;
          const project = await prisma.project.findUnique({
            where: { id: workspaceId },
            select: { organizationId: true },
          });
          const organizationId = project?.organizationId;

          capturePostHogEvent(
            environmentId,
            "app_connected",
            {
              num_surveys: surveys.length,
              num_code_actions: actionClasses.filter((ac) => ac.type === "code").length,
              num_no_code_actions: actionClasses.filter((ac) => ac.type === "noCode").length,
              organization_id: organizationId ?? "",
              workspace_id: workspaceId,
            },
            organizationId ? { organizationId, workspaceId } : undefined
          );
        }
      }

      // Build the response data
      const data: TJsEnvironmentState["data"] = {
        surveys,
        actionClasses,
        project: environment.project,
        ...(IS_RECAPTCHA_CONFIGURED ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY } : {}),
      };

      return { data };
    },
    createCacheKey.environment.state(environmentId),
    60 * 1000 // 1 minute in milliseconds
  );
};
