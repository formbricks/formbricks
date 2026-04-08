import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { TJsEnvironmentState } from "@formbricks/types/js";
import {
  addLegacyProjectOverwritesToList,
  addLegacyProjectToEnvironmentState,
} from "@/app/lib/api/api-backwards-compat";
import { cache } from "@/lib/cache";
import { IS_RECAPTCHA_CONFIGURED, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { getEnvironmentStateData } from "./data";

/**
 * Optimized environment state fetcher using new caching approach
 * Uses withCache for Redis-backed caching with graceful fallback
 * Single database query via optimized data service
 *
 * @param workspaceId - The workspace ID to fetch state for
 * @returns The environment state
 * @throws ResourceNotFoundError if workspace not found
 */
export const getEnvironmentState = async (
  workspaceId: string
): Promise<{ data: TJsEnvironmentState["data"] }> => {
  return cache.withCache(
    async () => {
      // Single optimized database call replacing multiple service calls
      const { workspace, surveys, actionClasses } = await getEnvironmentStateData(workspaceId);

      // Handle app setup completion update if needed
      // This is a one-time setup flag that can tolerate TTL-based cache expiration
      if (!workspace.appSetupCompleted) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { appSetupCompleted: true },
        });
      }

      // Build the response data
      // Backwards compat: include `project` alongside `workspace`, and
      // `projectOverwrites` alongside `workspaceOverwrites` in each survey
      const data = addLegacyProjectToEnvironmentState({
        surveys: addLegacyProjectOverwritesToList(surveys),
        actionClasses,
        workspace,
        ...(IS_RECAPTCHA_CONFIGURED ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY } : {}),
      } as TJsEnvironmentState["data"]);

      return { data };
    },
    createCacheKey.environment.state(workspaceId),
    60 * 1000 // 1 minute in milliseconds
  );
};
