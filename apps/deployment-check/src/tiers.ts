/**
 * Checks run in tiers so one root cause is reported once instead of as a wall of red.
 * `infra` gates everything; `auth` gates everything that needs a key. The last three are independent of
 * each other, so a storage outage does not hide whether the SDK bundle is served.
 */
export const TIERS = ["infra", "auth", "survey-loop", "storage", "sdk"] as const;

export type TTier = (typeof TIERS)[number];

const REQUIRES: Record<TTier, readonly TTier[]> = {
  infra: [],
  auth: ["infra"],
  "survey-loop": ["infra", "auth"],
  storage: ["infra", "auth"],
  sdk: ["infra", "auth"],
};

/** Returns why a tier must be skipped, or `undefined` when all its prerequisites passed. */
export const skipReason = (tier: TTier, failed: readonly TTier[]): string | undefined => {
  const blocker = REQUIRES[tier].find((required) => failed.includes(required));
  return blocker ? `skipped: ${blocker} failed` : undefined;
};
