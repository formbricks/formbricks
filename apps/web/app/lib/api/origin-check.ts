import { AUTH_TRUSTED_ORIGINS, BETTER_AUTH_ENV_TRUSTED_ORIGINS, WEBAPP_URL } from "@/lib/constants";

/**
 * Cross-site request forgery protection for requests that carry an ambient credential: the session
 * cookie, or nothing at all on a pre-login route. API-key and bearer callers are never checked: they send
 * their credential on purpose, the browser never attaches it on someone else's behalf.
 *
 * `SameSite=Lax` is judged by *site*, so a script on any sibling host under the same registrable domain
 * still gets the cookie attached to its POSTs, and `text/plain` or multipart bodies need no preflight.
 * Route handlers get no `Origin` check from Next.js (server actions do), so the API wrappers (`withV1ApiWrapper`,
 * `withV3ApiWrapper`) and the session routes outside them bring one.
 *
 * The algorithm is Go 1.25's `http.CrossOriginProtection` (as described by Filippo Valsorda), made
 * fail-safe for a browser-only surface, as OWASP recommends for sensitive endpoints:
 * 1. `GET`, `HEAD` and `OPTIONS` pass. They must not change state.
 * 2. When `Sec-Fetch-Site` is present, only `same-origin` passes. `same-site` is refused: a sibling
 *    subdomain is not trusted. There is no fallback to `Origin` once the header is present.
 * 3. Without `Sec-Fetch-Site` (an older browser, or plain HTTP, where browsers send it only for
 *    localhost), `Origin` must be one of the configured origins, or have the same host as the request:
 *    the first `X-Forwarded-Host` value, else `Host`. That second rule is exactly the one Next.js applies
 *    to server actions, so a self-hosted instance reached by LAN address or by an alternate hostname keeps
 *    working as it did before the move to routes. A cross-site page can't satisfy it: its `Origin` is its
 *    own host, and it can't set `X-Forwarded-Host` without a CORS preflight that fails.
 *    `Origin: null` never matches.
 * 4. With neither header, the request is refused. Go assumes a non-browser caller here (Next lets it
 *    through); no non-browser caller may use a session or pre-login route, so refusing costs nothing.
 *
 * The configured origins are those Better Auth trusts for sign-in (`BETTER_AUTH_URL` / `NEXTAUTH_URL` and
 * `BETTER_AUTH_TRUSTED_ORIGINS`) plus the app's own `WEBAPP_URL`.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isSafeMethod = (method: string): boolean => SAFE_METHODS.has(method.toUpperCase());

/**
 * Origins the app serves itself from, reduced to the bare origin so they compare with `Origin`. The
 * `BETTER_AUTH_TRUSTED_ORIGINS` entries are included exactly as configured: a wildcard entry (`https://*.
 * example.com`) is not a valid URL origin and drops out, so it stays sign-in-only.
 */
const toOrigin = (url: string): string | null => {
  try {
    const origin = new URL(url).origin;
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
};

const TRUSTED_ORIGINS: ReadonlySet<string> = new Set(
  [...AUTH_TRUSTED_ORIGINS, ...BETTER_AUTH_ENV_TRUSTED_ORIGINS, WEBAPP_URL]
    .map(toOrigin)
    .filter((origin): origin is string => origin !== null)
);

/** Why a request was refused, for the log line. Never sent to the caller. */
export type TCrossOriginRefusal = "sec_fetch_site" | "untrusted_origin" | "no_origin";

/** Whether `Origin` names the host this request was sent to, as Next.js decides for server actions. */
const isSameHost = (origin: string, headers: Headers): boolean => {
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  if (!originHost) return false;
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  return originHost === (forwardedHost || headers.get("host") || "").toLowerCase();
};

/** `null` when the request may proceed, otherwise why it is refused. */
export const getCrossOriginRefusal = (req: Request): TCrossOriginRefusal | null => {
  if (isSafeMethod(req.method)) return null;

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite !== null) {
    return secFetchSite === "same-origin" ? null : "sec_fetch_site";
  }

  const origin = req.headers.get("origin");
  if (origin === null) return "no_origin";
  return TRUSTED_ORIGINS.has(origin) || isSameHost(origin, req.headers) ? null : "untrusted_origin";
};

/** The media type of a `Content-Type` header, without its parameters (`; charset=utf-8`). */
export const mediaTypeOf = (contentType: string | null): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

export const isJsonContentType = (contentType: string | null): boolean =>
  mediaTypeOf(contentType) === "application/json";
