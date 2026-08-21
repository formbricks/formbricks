/**
 * "How did you find out about Formbricks?" — a self-reported signal captured on sign-up,
 * complementing the URL/cookie-based attribution in `attribution.ts`. Entirely optional.
 */

export const DISCOVERY_SOURCES = [
  "blog",
  "llm",
  "powered_by_badge",
  "saw_a_survey",
  "search_engine",
  "social_media",
  "referral",
  "event",
  "other",
] as const;

export type TDiscoverySource = (typeof DISCOVERY_SOURCES)[number];

// Sources whose selection reveals a follow-up free-text field.
export const DISCOVERY_SOURCES_WITH_FOLLOWUP: ReadonlySet<TDiscoverySource> = new Set([
  "blog",
  "llm",
  "other",
]);

export const MAX_DISCOVERY_SOURCE_DETAIL_LENGTH = 256;
