import "server-only";
import { AUTH_TRUSTED_ORIGINS, BETTER_AUTH_ENV_TRUSTED_ORIGINS, WEBAPP_URL } from "@/lib/constants";

/**
 * Cross-site request forgery protection for requests that carry an ambient credential: the session
 * cookie, or nothing at all on a pre-login route. API-key requests are exempt — a key is sent on
 * purpose, never attached by the browser on someone else's behalf.
 *
 * Server actions got an `Origin` check from Next.js for free; route handlers get nothing, so moving the
 * UI onto routes has to bring the check along (ENG-3380, ENG-3984). `SameSite=Lax` on the session cookie
 * is not enough on its own: it is judged by *site*, so every other host under the same registrable domain
 * (on Cloud, every `*.formbricks.com` host; on self-host, typically the `PUBLIC_URL` survey domain) gets
 * the cookie attached to its POSTs.
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

const toOrigin = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const TRUSTED_ORIGINS: ReadonlySet<string> = new Set(
  [...AUTH_TRUSTED_ORIGINS, ...BETTER_AUTH_ENV_TRUSTED_ORIGINS, WEBAPP_URL]
    .map(toOrigin)
    .filter((origin): origin is string => origin !== null && origin !== "null")
);

/** Why a request was refused, for the log line. Never sent to the caller. */
export type TCrossOriginRefusal = "sec_fetch_site" | "untrusted_origin" | "no_origin";

/** `null` when the request may proceed, otherwise why it is refused. */
export const getCrossOriginRefusal = (req: Request): TCrossOriginRefusal | null => {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null;

  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite !== null) {
    return secFetchSite === "same-origin" ? null : "sec_fetch_site";
  }

  const origin = req.headers.get("origin");
  if (origin === null) return "no_origin";
  if (TRUSTED_ORIGINS.has(origin)) return null;
  return isSameHost(origin, req.headers) ? null : "untrusted_origin";
};

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
  return originHost === (forwardedHost || headers.get("host"));
};
