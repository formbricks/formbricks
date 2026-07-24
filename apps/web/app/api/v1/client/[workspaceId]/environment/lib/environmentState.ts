import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { prisma } from "@formbricks/database";
import { TJsWorkspaceState } from "@formbricks/types/js";
import {
  addLegacyProjectOverwritesToList,
  addLegacyProjectToEnvironmentState,
} from "@/app/lib/api/api-backwards-compat";
import { cache } from "@/lib/cache";
import { IS_RECAPTCHA_CONFIGURED, POSTHOG_KEY, RECAPTCHA_SITE_KEY } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { getOrganizationIdFromWorkspaceId } from "@/lib/utils/helper";
import { getWorkspaceStateData } from "./data";

/**
 * Optimized environment state fetcher using new caching approach
 * Uses withCache for Redis-backed caching with graceful fallback
 * Single database query via optimized data service
 *
 * @param workspaceId - The workspace ID to fetch state for
 * @returns The environment state
 * @throws ResourceNotFoundError if workspace not found
 */
export const getWorkspaceState = async (
  workspaceId: string
): Promise<{ data: TJsWorkspaceState["data"] }> => {
  return cache.withCache(
    async () => {
      // Single optimized database call replacing multiple service calls
      const { workspace, surveys, actionClasses, hasSurveyInteractionSegments } =
        await getWorkspaceStateData(workspaceId);

      // Handle app setup completion update if needed
      // This is a one-time setup flag that can tolerate TTL-based cache expiration
      if (!workspace.appSetupCompleted) {
        await prisma.workspace.update({
          where: { id: workspaceId },
          data: { appSetupCompleted: true },
        });

        if (POSTHOG_KEY) {
          const organizationId = await getOrganizationIdFromWorkspaceId(workspaceId);
          capturePostHogEvent(
            workspaceId,
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
      // Backwards compat: include `project` alongside `workspace`, and
      // `projectOverwrites` alongside `workspaceOverwrites` in each survey
      const data = addLegacyProjectToEnvironmentState({
        surveys: addLegacyProjectOverwritesToList(surveys),
        actionClasses,
        workspace: workspace.workspaceSettings,
        hasSurveyInteractionSegments,
        ...(IS_RECAPTCHA_CONFIGURED ? { recaptchaSiteKey: RECAPTCHA_SITE_KEY } : {}),
      } as TJsWorkspaceState["data"]);

      return { data };
    },
    createCacheKey.workspace.state(workspaceId),
    60 * 1000 // 1 minute in milliseconds
  );
};
