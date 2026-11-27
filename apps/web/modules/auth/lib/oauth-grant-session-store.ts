import { APIError } from "better-auth/api";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

/**
 * The routes that turn a session into a credential or grant that outlives it: `authorize` mints an
 * authorization code when a consent already covers the request, `consent` records the approval and mints
 * one, `continue` resumes a pending authorization after sign-in or organization selection, and
 * `update-consent` widens the scopes a stored consent covers, so the next `authorize` skips the consent
 * screen. A code exchanges for tokens that survive every revocation of the session. `delete-consent` only
 * removes a grant and the `get-consent*` routes only read, so they stay on the cache.
 */
const OAUTH_GRANT_PATHS: ReadonlySet<string> = new Set([
  "/oauth2/authorize",
  "/oauth2/consent",
  "/oauth2/continue",
  "/oauth2/update-consent",
]);

// The matcher below must read a cookie name the way Better Auth's parsers do. `better-auth-trust-device-gate.ts`
// carries an older copy that does not (ENG-7559); fix both together when that ticket is picked up.

/** `<name>` and its chunks `<name>.0`, `<name>.1`, …: Better Auth splits a large cookie cache value. */
const isCookieNamedOrChunkOf = (cookieName: string, name: string): boolean =>
  name === cookieName ||
  (name.startsWith(`${cookieName}.`) && /^\d+$/.test(name.slice(cookieName.length + 1)));

/**
 * The readers (better-call's and Better Auth's `parseCookies`) trim whitespace around the cookie name, so
 * `session_data =jwt` is the cache cookie to them. Match the same way: trim the name, and ignore a segment
 * with no `=`, which neither parser reads. `String.trim` removes a superset of what they do, which only
 * over-strips.
 */
const cookieNameOf = (pair: string): string | null => {
  const eq = pair.indexOf("=");
  return eq === -1 ? null : pair.slice(0, eq).trim();
};

const withoutCookieAndChunks = (cookieHeader: string, cookieName: string): string =>
  cookieHeader
    .split(";")
    .filter((pair) => {
      const name = cookieNameOf(pair);
      return name === null || !isCookieNamedOrChunkOf(cookieName, name);
    })
    .join(";")
    .trim();

/**
 * Better Auth `before` hook (GHSA-fvxx-76fc-893x): the OAuth provider resolves the browser's session with
 * `getSessionFromCtx`, which trusts a valid `session_data` cookie (`session.cookieCache`, 5 minutes)
 * without reading Redis or Postgres. A session revoked in both stores could therefore still mint an
 * authorization code. Better Auth 1.7.16 re-reads the store on its own passkey, device-authorization,
 * two-factor, social-link and phone-number routes, but not on these.
 *
 * Dropping the cache cookie from the request makes every later `getSessionFromCtx` on it, the endpoint's
 * and our own consent hooks', fall through to the session store, which is authoritative: the session token
 * cookie alone still identifies the session, and the response re-issues the cache for a live one. Other
 * routes keep the cache, so the cost is one store read on three routes a person reaches a handful of times
 * per authorization.
 *
 * It edits `ctx.headers` in place instead of returning a context patch: Better Auth applies a patch only
 * after the whole hook has run, and our consent hooks read the session first and park it on the shared
 * context, where the endpoint would reuse the cached one. This must run before them. `ctx.headers` is the
 * request's own copy, not the caller's `Headers`.
 */
export const oauthGrantReadsSessionStoreBeforeHandler = (ctx: AuthHookContext): void => {
  if (!OAUTH_GRANT_PATHS.has(ctx.path)) return;

  // The cookie's real name carries Better Auth's configured prefix (`__Secure-` over https).
  const cacheCookieName = ctx.context.authCookies.sessionData.name;

  if (!ctx.headers) {
    // Better Auth then reads the cookie from `ctx.request`, which this hook must not edit. Every caller in
    // the app goes through HTTP or passes `headers`; refuse rather than let a request-only call keep the cache.
    const requestCookie = ctx.request?.headers.get("cookie");
    if (requestCookie && withoutCookieAndChunks(requestCookie, cacheCookieName) !== requestCookie.trim()) {
      throw new APIError("BAD_REQUEST", { message: "Session cache cookie is not accepted on this route" });
    }
    return;
  }

  const cookieHeader = ctx.headers.get("cookie");
  if (!cookieHeader) return;

  const stripped = withoutCookieAndChunks(cookieHeader, cacheCookieName);
  if (stripped !== cookieHeader.trim()) ctx.headers.set("cookie", stripped);
};
