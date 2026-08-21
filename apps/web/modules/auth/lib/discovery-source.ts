import { z } from "zod";

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

// Trim before enforcing the max length, so whitespace padding can't push otherwise-valid content over
// the limit. Shared between the client (ZSignupInput) and server (ZCreateUserAction) schemas.
export const ZDiscoverySourceDetail = z.string().trim().max(MAX_DISCOVERY_SOURCE_DETAIL_LENGTH).optional();

/**
 * Trims the free-text follow-up and drops it unless it belongs to a source that actually takes one.
 * `createUserAction` is unauthenticated, so a direct POST can send a detail with no `discoverySource`
 * (or one that doesn't take a follow-up, e.g. "referral") — the sign-up form's own clearing logic
 * doesn't run server-side, so this is the boundary that keeps an orphaned/whitespace-only detail out
 * of the PostHog event.
 */
export const normalizeDiscoverySourceDetail = (
  discoverySource: TDiscoverySource | undefined,
  discoverySourceDetail: string | undefined
): string | undefined => {
  if (!discoverySource || !DISCOVERY_SOURCES_WITH_FOLLOWUP.has(discoverySource)) return undefined;
  const trimmed = discoverySourceDetail?.trim();
  return trimmed || undefined;
};
