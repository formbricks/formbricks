export type TPostHogFeatureFlagValue = boolean | string;

export type TPostHogFeatureFlagContext = {
  organizationId?: string;
  workspaceId?: string;
};

/**
 * A flag evaluation that keeps "PostHog answered" apart from "PostHog could not be asked".
 *
 * `evaluated` covers an explicit `false` and a flag PostHog does not return at all (missing, deleted or
 * inactive), both as `value: false`. `unavailable` is a failed request, a quota block, a flag PostHog
 * itself reports as failed, or PostHog not being configured — the cases where a caller may fall back to
 * an earlier decision instead of treating the flag as off.
 */
export type TPostHogFeatureFlagEvaluation =
  | { status: "evaluated"; value: TPostHogFeatureFlagValue }
  | { status: "unavailable" };
