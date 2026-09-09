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

export type TPostHogClientEventProperties = Record<
  string,
  string | number | boolean | string[] | null | undefined
>;

/**
 * Capture a product event from the browser when PostHog is initialised, and drop it otherwise.
 * PostHog is initialised lazily by `PostHogIdentify` and is absent when `POSTHOG_KEY` is unset. For
 * an event behind a user action the guard is enough: by the time someone clicks, the SDK is loaded.
 */
export const capturePostHogClientEvent = (
  event: string,
  properties?: TPostHogClientEventProperties
): void => {
  if (!posthog.__loaded) return;
  posthog.capture(event, properties);
};

// `PostHogIdentify` initialises the SDK from a useEffect in a parent layout, and React runs a child's
// effects before its parent's, so an event captured on mount finds the SDK not yet loaded on a fresh
// page load. Mirrors PostHogGroupIdentify: poll briefly, then give up (no POSTHOG_KEY on this host).
const READY_POLL_INTERVAL_MS = 50;
const READY_POLL_TIMEOUT_MS = 5000;

const noop = (): void => undefined;

/**
 * Capture an event as soon as PostHog is ready, for events that fire on mount rather than on a user
 * action. Captures at once when the SDK is already loaded. Returns a cancel function for effect
 * cleanup, so a component that unmounts, or re-runs its effect under strict mode, never double-reports.
 */
export const capturePostHogClientEventWhenReady = (
  event: string,
  properties?: TPostHogClientEventProperties
): (() => void) => {
  if (posthog.__loaded) {
    posthog.capture(event, properties);
    return noop;
  }

  let intervalId: ReturnType<typeof setInterval> | undefined;
  const timeoutId = setTimeout(() => clearInterval(intervalId), READY_POLL_TIMEOUT_MS);
  intervalId = setInterval(() => {
    if (!posthog.__loaded) return;
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    posthog.capture(event, properties);
  }, READY_POLL_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
    clearTimeout(timeoutId);
  };
};

export type { TPostHogFeatureFlagContext, TPostHogFeatureFlagValue } from "./types";
