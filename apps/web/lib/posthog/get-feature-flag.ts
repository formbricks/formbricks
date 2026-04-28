import "server-only";
import { logger } from "@formbricks/logger";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { posthogServerClient } from "./server";
import { TPostHogFeatureFlagContext, TPostHogFeatureFlagValue } from "./types";

const buildPostHogGroups = (context?: TPostHogFeatureFlagContext): Record<string, string> | undefined => {
  const groups = {
    ...(context?.organizationId ? { organization: context.organizationId } : {}),
    ...(context?.workspaceId ? { workspace: context.workspaceId } : {}),
  };

  return Object.keys(groups).length > 0 ? groups : undefined;
};

export const getPostHogFeatureFlag = async (
  distinctId: string,
  flagKey: string,
  context?: TPostHogFeatureFlagContext
): Promise<TPostHogFeatureFlagValue> => {
  if (!IS_FORMBRICKS_CLOUD || !posthogServerClient) {
    return false;
  }

  try {
    const featureFlagValue = await posthogServerClient.getFeatureFlag(flagKey, distinctId, {
      groups: buildPostHogGroups(context),
    });

    return featureFlagValue === undefined ? false : featureFlagValue;
  } catch (error) {
    logger.warn({ error, flagKey }, "Failed to evaluate PostHog feature flag");
    return false;
  }
};
