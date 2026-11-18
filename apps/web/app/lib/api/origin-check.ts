import { AUTH_TRUSTED_ORIGINS } from "@/lib/constants";

/**
 * Cross-site request forgery protection for requests that ride the session cookie (ENG-3380).
 *
 * `SameSite=Lax` is judged by *site*, so a script on any sibling host under the same registrable domain
 * still gets the cookie attached to its POSTs, and `text/plain` or multipart bodies need no preflight.
 * Route handlers get no `Origin` check from Next.js (server actions do), so the API wrappers (`withV1ApiWrapper`,
 * `withV3ApiWrapper`) and the session routes outside them bring one.
 * API-key and bearer callers are never checked: they send their credential on purpose, the browser
 * never attaches it on someone else's behalf.
 *
 * What a browser actually sends decides the rule:
 * 1. `GET`, `HEAD` and `OPTIONS` pass; they must not change state.
 * 2. `Sec-Fetch-Site` present (modern browsers, on HTTPS or localhost): `same-origin` and `none` pass,
 *    `same-site` (a sibling subdomain) and `cross-site` are refused. No fallback to `Origin`.
 * 3. No `Sec-Fetch-Site` (older browser, or plain HTTP on a LAN address) but an `Origin`: it must be a
 *    trusted origin (the same list Better Auth trusts, which includes `WEBAPP_URL`) or name the host the
 *    request was sent to, the rule Next.js applies to server actions. `Origin: null` never matches.
 * 4. Neither header: a browser sends `Origin` on every cross-origin POST, so only a non-browser caller (or a
 *    very old same-origin request) gets here. It cannot be a cross-site forgery and passes.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isSafeMethod = (method: string): boolean => SAFE_METHODS.has(method.toUpperCase());

/** Origins the app serves itself from, reduced to the bare origin so they compare with `Origin`. */
const TRUSTED_ORIGINS: ReadonlySet<string> = new Set(AUTH_TRUSTED_ORIGINS);

/** Why a request was refused, for the log line. Never sent to the caller. */
export type TCrossOriginRefusal = "sec_fetch_site" | "untrusted_origin";

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
    return secFetchSite === "same-origin" || secFetchSite === "none" ? null : "sec_fetch_site";
  }

  const origin = req.headers.get("origin");
  if (origin === null) return null;
  return TRUSTED_ORIGINS.has(origin) || isSameHost(origin, req.headers) ? null : "untrusted_origin";
};

/** The media type of a `Content-Type` header, without its parameters (`; charset=utf-8`). */
export const mediaTypeOf = (contentType: string | null): string =>
  (contentType ?? "").split(";")[0].trim().toLowerCase();

export const isJsonContentType = (contentType: string | null): boolean =>
  mediaTypeOf(contentType) === "application/json";
