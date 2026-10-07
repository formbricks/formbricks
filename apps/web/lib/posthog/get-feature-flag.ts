import "server-only";
import { logger } from "@formbricks/logger";
import { POSTHOG_KEY } from "@/lib/constants";
import { posthogServerClient } from "./server";
import type {
  TPostHogFeatureFlagContext,
  TPostHogFeatureFlagEvaluation,
  TPostHogFeatureFlagValue,
} from "./types";

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
  if (!POSTHOG_KEY || !posthogServerClient) {
    return false;
  }

  try {
    const featureFlagValue = await posthogServerClient.getFeatureFlag(flagKey, distinctId, {
      groups: buildPostHogGroups(context),
    });

    return featureFlagValue ?? false;
  } catch (error) {
    logger.warn({ error, flagKey }, "Failed to evaluate PostHog feature flag");
    return false;
  }
};

type TPostHogFlagDetail = { enabled?: boolean; variant?: string | null; failed?: boolean };

type TPostHogFlagDetailsResponse = {
  flags?: Record<string, TPostHogFlagDetail | undefined>;
  errorsWhileComputingFlags?: boolean;
  quotaLimited?: string[];
};

/**
 * The SDK's remote `/flags` call, which answers `undefined` when the request failed. It is `protected` on
 * the client: every public flag method folds that failure into the same `undefined` a missing flag
 * produces, so it is the only way to tell the two apart. Typed structurally so an SDK that drops it
 * degrades to `unavailable` rather than to a wrong answer.
 */
type TPostHogFlagDetailsReader = {
  getFeatureFlagDetailsStateless?: (
    distinctId: string,
    groups?: Record<string, string>,
    personProperties?: Record<string, string>,
    groupProperties?: Record<string, Record<string, string>>,
    disableGeoip?: boolean,
    flagKeysToEvaluate?: string[]
  ) => Promise<TPostHogFlagDetailsResponse | undefined>;
};

const toFlagValue = (detail: TPostHogFlagDetail): TPostHogFeatureFlagValue =>
  detail.enabled ? (detail.variant ?? true) : false;

/**
 * Evaluate one flag remotely and say whether PostHog actually answered — the distinction
 * `getPostHogFeatureFlag` deliberately collapses to `false`, and which a rollout that may reuse its last
 * decision during an outage needs (ENG-3552). Existing callers keep `getPostHogFeatureFlag` unchanged.
 */
export const evaluatePostHogFeatureFlag = async (
  distinctId: string,
  flagKey: string,
  context?: TPostHogFeatureFlagContext
): Promise<TPostHogFeatureFlagEvaluation> => {
  if (!POSTHOG_KEY || !posthogServerClient) {
    return { status: "unavailable" };
  }

  const reader = posthogServerClient as unknown as TPostHogFlagDetailsReader;
  if (typeof reader.getFeatureFlagDetailsStateless !== "function") {
    logger.warn({ flagKey }, "PostHog client cannot report flag evaluation failures");
    return { status: "unavailable" };
  }

  try {
    const response = await reader.getFeatureFlagDetailsStateless.call(
      posthogServerClient,
      distinctId,
      buildPostHogGroups(context),
      undefined,
      undefined,
      undefined,
      [flagKey]
    );

    if (!response || response.quotaLimited?.includes("feature_flags")) {
      return { status: "unavailable" };
    }

    const detail = response.flags?.[flagKey];
    if (detail?.failed) {
      return { status: "unavailable" };
    }

    if (!detail) {
      // A flag PostHog could not compute is as absent as one that does not exist; only the first is
      // an outage.
      return response.errorsWhileComputingFlags
        ? { status: "unavailable" }
        : { status: "evaluated", value: false };
    }

    return { status: "evaluated", value: toFlagValue(detail) };
  } catch (error) {
    logger.warn({ error, flagKey }, "Failed to evaluate PostHog feature flag");
    return { status: "unavailable" };
  }
};
