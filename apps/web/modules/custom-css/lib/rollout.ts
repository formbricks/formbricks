import "server-only";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { evaluatePostHogFeatureFlag } from "@/lib/posthog/get-feature-flag";

/** PostHog flag that rolls custom CSS out per organization on Formbricks Cloud (group `organization`). */
export const CUSTOM_CSS_ROLLOUT_FLAG = "custom-css";

/**
 * How long a decision is reused before PostHog is asked again. Matches the one-minute environment-state
 * cache, so turning the flag off takes effect on the same timescale as any other configuration change,
 * and bounds PostHog calls to one per organization per minute — also during an outage.
 */
export const CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS = 60 * 1000;

/** How long the last decision PostHog actually returned may stand in while PostHog is unreachable. */
export const CUSTOM_CSS_ROLLOUT_LAST_KNOWN_TTL_MS = 24 * 60 * 60 * 1000;

type TCachedRolloutDecision = { enabled: boolean };

const readDecision = async (key: ReturnType<typeof createCacheKey.customCss.rollout>) => {
  try {
    const result = await cache.get<TCachedRolloutDecision>(key);
    if (result.ok && typeof result.data?.enabled === "boolean") {
      return result.data.enabled;
    }
  } catch (error) {
    logger.warn({ error }, "Custom CSS rollout cache read failed");
  }
  return null;
};

const writeDecision = async (
  key: ReturnType<typeof createCacheKey.customCss.rollout>,
  enabled: boolean,
  ttlMs: number
) => {
  try {
    await cache.set(key, { enabled } satisfies TCachedRolloutDecision, ttlMs);
  } catch (error) {
    logger.warn({ error }, "Custom CSS rollout cache write failed");
  }
};

/**
 * Whether custom CSS is rolled out for this organization: respondent delivery and editor visibility only.
 * Saved CSS, permissions and the plan gate are independent of it, so API reads and writes keep working.
 *
 * - Self-hosted: always on, without asking PostHog and without an env var.
 * - Cloud: the `custom-css` flag for the organization group. Explicitly off, or missing → off.
 * - PostHog unreachable: the last decision PostHog actually returned, for up to 24 hours; none → off.
 */
export const getIsCustomCssRolledOut = async (organizationId: string): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) {
    return true;
  }

  const freshKey = createCacheKey.customCss.rollout(organizationId);
  const fresh = await readDecision(freshKey);
  if (fresh !== null) {
    return fresh;
  }

  const evaluation = await evaluatePostHogFeatureFlag(organizationId, CUSTOM_CSS_ROLLOUT_FLAG, {
    organizationId,
  });

  if (evaluation.status === "evaluated") {
    const enabled = evaluation.value !== false;
    await Promise.all([
      writeDecision(freshKey, enabled, CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS),
      writeDecision(
        createCacheKey.customCss.rolloutLastKnown(organizationId),
        enabled,
        CUSTOM_CSS_ROLLOUT_LAST_KNOWN_TTL_MS
      ),
    ]);
    return enabled;
  }

  const lastKnown = await readDecision(createCacheKey.customCss.rolloutLastKnown(organizationId));
  const enabled = lastKnown ?? false;
  logger.warn(
    { organizationId, fallback: lastKnown === null ? "off" : "last_known" },
    "PostHog unavailable for the custom CSS rollout flag"
  );
  // Short-lived on purpose and never into the last-known key: an outage must not extend the life of
  // the decision it is standing in for, but it also must not cost a PostHog timeout on every request.
  await writeDecision(freshKey, enabled, CUSTOM_CSS_ROLLOUT_FRESH_TTL_MS);
  return enabled;
};
