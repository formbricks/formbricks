"use client";

import posthog from "posthog-js";
import type { TPostHogFeatureFlagValue } from "./types";

export const getPostHogClientFeatureFlag = (flagKey: string): TPostHogFeatureFlagValue => {
  if (!posthog.__loaded) {
    return false;
  }

  const featureFlagValue = posthog.getFeatureFlag(flagKey);
  return featureFlagValue ?? false;
};

export type { TPostHogFeatureFlagContext, TPostHogFeatureFlagValue } from "./types";
