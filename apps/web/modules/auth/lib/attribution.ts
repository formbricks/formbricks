/**
 * Marketing attribution captured on the auth pages (login / signup).
 *
 * Only the whitelisted keys below are ever read or stored. These are non-personal,
 * non-user-unique marketing values (source / campaign / landing page), so the
 * `fb_attribution` cookie is a functional attribution cookie rather than user tracking.
 *
 * The cookie is written client-side (first-touch) on the auth pages and read
 * server-side at PostHog capture time for `user_signed_up` / `user_signed_in`.
 */

export const ATTRIBUTION_PARAM_KEYS = [
  "page",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "initial_source",
  "initial_pathname",
] as const;

export type TAttributionKey = (typeof ATTRIBUTION_PARAM_KEYS)[number];

export const ATTRIBUTION_COOKIE_NAME = "fb_attribution";

// 30 minutes: long enough to survive the OAuth redirect round-trip and any
// login/signup navigation, short enough that stale attribution cannot bleed onto
// a later (or different) user's events on a shared browser. See getAttributionPropertiesFromCookies
// consumers which also clear the cookie once it has been captured.
export const ATTRIBUTION_COOKIE_MAX_AGE = 60 * 30;

// Guard against oversized cookie values polluting events.
const MAX_ATTRIBUTION_VALUE_LENGTH = 256;

// Browsers silently reject cookies whose total size exceeds ~4KB. Keep the encoded
// value comfortably under that (accounting for the name and attributes).
export const MAX_ATTRIBUTION_COOKIE_VALUE_LENGTH = 3500;

type TCookieStore = {
  get: (name: string) => { value: string } | undefined;
};

/**
 * Extract only the whitelisted, non-empty attribution params from a URLSearchParams.
 */
export const pickAttributionParams = (params: URLSearchParams | null | undefined): Record<string, string> => {
  const result: Record<string, string> = {};
  if (!params) return result;

  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = params.get(key);
    if (value && value.trim().length > 0) {
      result[key] = value.trim().slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
    }
  }

  return result;
};

/**
 * Read the attribution cookie server-side and return validated, whitelisted
 * properties ready to spread into a PostHog event's properties. Returns an empty
 * object when the cookie is missing or malformed.
 */
export const getAttributionPropertiesFromCookies = (cookieStore: TCookieStore): Record<string, string> => {
  // Next's cookie store already percent-decodes the value, so `raw` is the plain
  // JSON string the client wrote (via encodeURIComponent). Do NOT decode again here —
  // a second decode corrupts any value that legitimately contains a `%XX` sequence.
  const raw = cookieStore.get(ATTRIBUTION_COOKIE_NAME)?.value;
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null) return {};

  const record = parsed as Record<string, unknown>;
  const result: Record<string, string> = {};

  for (const key of ATTRIBUTION_PARAM_KEYS) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      result[key] = value.trim().slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
    }
  }

  return result;
};

/**
 * Build a query-string suffix (e.g. `page=home&utm_source=x`, no leading `?`/`&`)
 * from the current attribution params, for forwarding across the login/signup links.
 * Returns an empty string when there is nothing to forward.
 */
export const buildAttributionQuerySuffix = (params: URLSearchParams | null | undefined): string => {
  const picked = pickAttributionParams(params);
  const search = new URLSearchParams(picked);
  return search.toString();
};
