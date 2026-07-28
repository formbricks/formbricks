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

let hasWarnedAboutUntrustedIp = false;

const warnOnceAboutUntrustedIp = (): void => {
  if (hasWarnedAboutUntrustedIp) return;
  hasWarnedAboutUntrustedIp = true;
  logger.error(
    "TRUSTED_PROXY_HOP_COUNT is 0 but the request carries forwarding headers. IP-based rate limiting " +
      "and IP capture cannot identify individual clients until it is set to the number of reverse " +
      "proxies in front of this app (1 for the shipped Traefik/Envoy and docker-compose topologies)."
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
 * `cf-connecting-ip` is honored only when at least one hop is trusted, since it is only meaningful
 * behind Cloudflare — a directly reachable app would let anyone set it.
 *
 * Exported separately from {@link getClientIpFromHeaders} so the parsing is unit-testable without
 * mocking `next/headers`.
 */
export const resolveClientIp = (headersList: Headers, hopCount: number): string => {
  const xForwardedFor = headersList.get("x-forwarded-for");

  if (hopCount <= 0) {
    if (xForwardedFor || headersList.get("cf-connecting-ip") || headersList.get("x-real-ip")) {
      warnOnceAboutUntrustedIp();
    }
    return UNTRUSTED_CLIENT_IP;
  }

  const cfConnectingIp = headersList.get("cf-connecting-ip")?.trim();
  if (cfConnectingIp) return cfConnectingIp;

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

  const xRealIp = headersList.get("x-real-ip")?.trim();
  if (xRealIp) return xRealIp;

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
