import { headers } from "next/headers";
import { logger } from "@formbricks/logger";
import { TRUSTED_PROXY_HOP_COUNT } from "@/lib/constants";

/**
 * Returned when no forwarding header may be believed, so the client is genuinely unidentifiable.
 *
 * Next 16 exposes no socket peer address to route handlers or server actions (`NextRequest.ip` was
 * removed and `headers()` carries only HTTP headers), so with no trusted proxy there is nothing else to
 * fall back to.
 */
export const UNTRUSTED_CLIENT_IP = "untrusted-client-ip";

/**
 * Throttle window for the misconfiguration warning. Time-based rather than once-per-process: a warning
 * that fires only on the first request goes silent for the life of a long-running deployment, so an
 * ongoing misconfiguration disappears from monitoring after one line. Raised by CodeRabbit on #8680.
 */
const UNTRUSTED_IP_WARNING_INTERVAL_MS = 10 * 60 * 1000;

let lastUntrustedIpWarningAt: number | null = null;

const warnAboutUntrustedIp = (): void => {
  const now = Date.now();
  if (
    lastUntrustedIpWarningAt !== null &&
    now - lastUntrustedIpWarningAt < UNTRUSTED_IP_WARNING_INTERVAL_MS
  ) {
    return;
  }
  lastUntrustedIpWarningAt = now;
  logger.error(
    "TRUSTED_PROXY_HOP_COUNT is set to 0 but the request carries forwarding headers. IP-based rate " +
      "limiting and IP capture cannot identify individual clients while no hop is trusted. Unset it to " +
      "take the default of 1, or set it to the number of reverse proxies actually in front of this app."
  );
};

/**
 * Resolves the client IP from forwarding headers, trusting only as many proxy hops as configured.
 *
 * `X-Forwarded-For` is *appended* to by each proxy, so its leftmost entry is whatever the client itself
 * sent — reading that, as this used to, let a caller supply any value. Because the result keys the
 * IP-based rate limits (login, forgot-password, signup, the public client API), a caller could rotate
 * the header to mint a fresh bucket per request and bypass all of them, and could also forge the
 * `ipAddress` recorded on responses and in audit-log entries.
 *
 * With `hopCount` proxies in front, the address the outermost trusted proxy observed is the
 * `hopCount`-th entry from the right; everything left of it is client-supplied and ignored.
 * `TRUSTED_PROXY_HOP_COUNT` defaults to 1, matching every supported topology; `0` is an explicit
 * opt-out that trusts nothing and therefore cannot identify a client at all.
 *
 * `cf-connecting-ip` is deliberately *not* consulted. It is only trustworthy when the request provably
 * came from Cloudflare's edge, and a hop count cannot establish that: `hopCount >= 1` says "one proxy is
 * in front", which for most deployments is Traefik, Envoy or nginx — none of which strip
 * `cf-connecting-ip`. Preferring it would therefore hand the spoof straight back to the caller. Nothing
 * is lost by dropping it: Cloudflare also puts the visitor address into `X-Forwarded-For`, so a
 * Cloudflare deployment is just `hopCount = 1` (or 2 with a proxy of its own behind it).
 *
 * Exported separately from {@link getClientIpFromHeaders} so the parsing is unit-testable without
 * mocking `next/headers`.
 */
export const resolveClientIp = (headersList: Headers, hopCount: number): string => {
  const xForwardedFor = headersList.get("x-forwarded-for");

  if (hopCount <= 0) {
    if (xForwardedFor || headersList.get("cf-connecting-ip") || headersList.get("x-real-ip")) {
      warnAboutUntrustedIp();
    }
    return UNTRUSTED_CLIENT_IP;
  }

  if (xForwardedFor) {
    const entries = xForwardedFor
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (entries.length > 0) {
      // Clamped rather than falling back to the leftmost entry: a request with fewer hops than
      // configured arrived through a shorter path than expected, and the earliest entry present is the
      // closest thing to what a trusted proxy saw.
      const index = Math.max(0, entries.length - hopCount);
      return entries[index];
    }
  }

  // No `x-real-ip` fallback. It is only reachable when no `X-Forwarded-For` arrived at all, and a proxy
  // that is genuinely in front appends to XFF — so the absence of XFF means the request did not come
  // through the trusted hop this app is configured for, and `x-real-ip` is then whatever the caller
  // chose to send. Reading it would restore exactly the per-request bucket rotation this function
  // exists to stop. This is the same argument the docstring makes against `cf-connecting-ip`; applying
  // it to one header and not the other was inconsistent. Raised by @pandeymangg on #8680.
  return UNTRUSTED_CLIENT_IP;
};

export async function getClientIpFromHeaders(): Promise<string> {
  let headersList: Headers;
  try {
    headersList = await headers();
  } catch (e) {
    logger.error(e, "Failed to get headers in getClientIpFromHeaders");
    return UNTRUSTED_CLIENT_IP;
  }

  return resolveClientIp(headersList, TRUSTED_PROXY_HOP_COUNT);
}
