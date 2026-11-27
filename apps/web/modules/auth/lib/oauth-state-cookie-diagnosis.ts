import { getCookieValueFromHeader, verifySignedCookieValue } from "./session-cookie";

/**
 * Which of Better Auth's four `state_security_mismatch` causes an OAuth callback hit (ENG-6692).
 *
 * On the database state strategy we run, Better Auth 1.7 rejects a callback with "State mismatch: State
 * not persisted correctly" whenever `getSignedCookie(state)` is falsy or differs from the `state` query
 * parameter (`better-auth/dist/state.mjs`, `parseGenericState`). better-call returns `null` for a missing
 * cookie and `false` for one whose HMAC does not verify, so four unrelated causes share one throw, one code
 * and one Sentry issue (FORMBRICKS-17B):
 *
 * | diagnosis | cause |
 * | --- | --- |
 * | `absent` | the cookie expired, or the browser dropped or blocked it |
 * | `signature_invalid` | the cookie does not verify with this server's secret: a replica whose `AUTH_SECRET` differs from the one that started the flow, or a tampered value |
 * | `state_differs` | the cookie verifies but carries another flow's state: a second sign-in in the same browser overwrote it, or a mixed-up callback |
 * | `matches` | the cookie is fine, so a `state_security_mismatch` came from the stored-record check instead |
 *
 * `signature_invalid` is the one that matters most: a secret split across replicas is a security-control
 * failure, not a sign-in annoyance, and until this diagnosis nothing separated it from the benign three.
 *
 * Reads the cookie with the same signed-cookie verification the session cookie uses (session-cookie.ts),
 * rather than better-call's, which is not a dependency of this app. The format is pinned against Better
 * Auth's real signer by `oauth-state-cookie-diagnosis.contract.test.ts`, so an upstream change fails there.
 *
 * One deliberate difference from better-call: a present cookie that is malformed (no signature, or one of
 * the wrong shape) reads as `null` there, the same as a missing one. Here it is `signature_invalid`,
 * because a cookie that is present but unverifiable is not a dropped cookie.
 *
 * Returns only the label, never the cookie or the state: the state is a single-use credential for the
 * in-flight flow and has no business in a log line or a Sentry tag.
 */
export type TOAuthStateCookieDiagnosis = "absent" | "signature_invalid" | "state_differs" | "matches";

export interface OAuthStateCookie {
  /** The full cookie name Better Auth reads, prefix included, from `createAuthCookie("state")`. */
  name: string;
  /** The secret Better Auth signs and verifies the cookie with (`context.secret`). */
  secret: string;
}

/**
 * Diagnose the state cookie a callback request carries, or `undefined` for a request with no `state`
 * parameter (not an OAuth callback, so there is nothing to diagnose).
 */
export const diagnoseOAuthStateCookie = (
  request: Request,
  cookie: OAuthStateCookie
): TOAuthStateCookieDiagnosis | undefined => {
  const state = new URL(request.url).searchParams.get("state");
  if (state === null) return undefined;

  const cookieHeader = request.headers.get("cookie") ?? "";
  // Presence is checked apart from the value: a cookie sent empty or not decodable was not dropped.
  const isPresent = cookieHeader.split(";").some((pair) => pair.trim().startsWith(`${cookie.name}=`));
  if (!isPresent) return "absent";

  const signed = getCookieValueFromHeader(cookieHeader, cookie.name);
  if (!signed) return "signature_invalid";

  const value = verifySignedCookieValue(signed, cookie.secret);
  if (value === null) return "signature_invalid";
  return value === state ? "matches" : "state_differs";
};
