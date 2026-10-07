import { PostHog } from "posthog-node";
import { describe, expect, test } from "vitest";

// `evaluatePostHogFeatureFlag` reads flag details through this undocumented client method, because the
// public `getFeatureFlag` cannot tell an outage from a flag that is off. An upgrade that drops it would
// turn every evaluation into "unavailable" and keep the Custom CSS rollout off without an error.
describe("posthog-node client contract", () => {
  test("still exposes getFeatureFlagDetailsStateless", () => {
    const prototype = PostHog.prototype as unknown as Record<string, unknown>;
    expect(typeof prototype.getFeatureFlagDetailsStateless).toBe("function");
  });
});
