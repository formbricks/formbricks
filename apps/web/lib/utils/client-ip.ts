import { isValidIP, normalizeIP } from "@better-auth/core/utils/ip";
import { headers } from "next/headers";
import { logger } from "@formbricks/logger";

/** Private request header written by Proxy after the trusted forwarding hop has been resolved. */
export const FORMBRICKS_CLIENT_IP_HEADER = "x-formbricks-client-ip";

/** Collapse IPv6 identities to a stable network prefix before rate limiting or persistence. */
export const CLIENT_IP_IPV6_SUBNET_PREFIX = 64;

/** Better Auth must consume exactly the same private request identity as the rest of Formbricks. */
export const BETTER_AUTH_IP_ADDRESS_CONFIG = {
  ipAddressHeaders: [FORMBRICKS_CLIENT_IP_HEADER],
  ipv6Subnet: CLIENT_IP_IPV6_SUBNET_PREFIX,
};

/** Stable downstream identity when Proxy could not establish a trustworthy client address. */
export const UNTRUSTED_CLIENT_IP = "untrusted-client-ip";

const CLIENT_IP_WARNING_INTERVAL_MS = 10 * 60 * 1000;
const VALID_DECIMAL_PORT = /^[1-9]\d{0,4}$/;
const BRACKETED_ADDRESS = /^\[([^[\]]+)\](?::([^:]+))?$/;
const IPV4_SOCKET = /^([^:]+):(\d+)$/;

type ClientIpWarningReason = "disabled" | "invalid-selected-hop" | "missing-chain" | "short-chain";

const clientIpWarningMessages: Record<ClientIpWarningReason, string> = {
  disabled:
    "Client IP resolution is disabled because TRUSTED_PROXY_HOP_COUNT is 0 while forwarding headers " +
    "are present. IP-based limits and captured IP metadata will use the shared untrusted identity.",
  "missing-chain":
    "Client IP resolution failed because X-Forwarded-For is absent. Configure the proxy to append it; " +
    "x-real-ip and cf-connecting-ip are not trusted client identity sources.",
  "short-chain":
    "Client IP resolution failed because X-Forwarded-For has fewer entries than " +
    "TRUSTED_PROXY_HOP_COUNT. Verify that every configured proxy appends to the forwarding chain.",
  "invalid-selected-hop":
    "Client IP resolution failed because the selected trusted X-Forwarded-For hop is not a valid " +
    "supported IP address. The request will use the shared untrusted identity.",
};

const lastClientIpWarningAt: Partial<Record<ClientIpWarningReason, number>> = {};

const warnAboutClientIp = (reason: ClientIpWarningReason): void => {
  const now = Date.now();
  const lastWarningAt = lastClientIpWarningAt[reason];
  if (lastWarningAt !== undefined && now - lastWarningAt < CLIENT_IP_WARNING_INTERVAL_MS) return;

  lastClientIpWarningAt[reason] = now;
  logger.warn(clientIpWarningMessages[reason]);
};

const isValidPort = (port: string): boolean => {
  if (!VALID_DECIMAL_PORT.test(port)) return false;
  return Number(port) <= 65_535;
};

const canonicalizeIp = (ip: string): string | null => {
  if (!isValidIP(ip)) return null;
  return normalizeIP(ip, { ipv6Subnet: CLIENT_IP_IPV6_SUBNET_PREFIX });
};

/**
 * Parse the selected X-Forwarded-For token without guessing at ambiguous socket forms.
 *
 * Azure Application Gateway can append an IPv4 client port. Bracketed IPv6 follows the standard
 * unambiguous socket spelling; a valid unbracketed IPv6 value is always treated as an address.
 */
const canonicalizeForwardedIp = (value: string): string | null => {
  const plainIp = canonicalizeIp(value);
  if (plainIp) return plainIp;

  const bracketedMatch = BRACKETED_ADDRESS.exec(value);
  if (bracketedMatch) {
    const address = bracketedMatch[1];
    const port = bracketedMatch[2];
    if (!address?.includes(":") || (port !== undefined && !isValidPort(port))) return null;
    return canonicalizeIp(address);
  }

  const ipv4SocketMatch = IPV4_SOCKET.exec(value);
  if (ipv4SocketMatch) {
    const address = ipv4SocketMatch[1];
    const port = ipv4SocketMatch[2];
    if (!address || !port || !isValidPort(port)) return null;

    const canonicalAddress = canonicalizeIp(address);
    return canonicalAddress?.includes(":") ? null : canonicalAddress;
  }

  return null;
};

const hasAnyForwardingHeader = (headersList: Headers): boolean =>
  ["x-forwarded-for", "x-real-ip", "cf-connecting-ip"].some((header) => headersList.has(header));

/**
 * Resolve and canonicalize the exact trusted hop from X-Forwarded-For.
 *
 * Proxy is the only caller. Entries to the left of the configured hop can be client-supplied and are
 * ignored. A missing, short, or malformed chain fails closed instead of falling back to another raw
 * forwarding header or clamping to the leftmost entry.
 */
export const resolveClientIp = (headersList: Headers, hopCount: number): string | null => {
  if (hopCount <= 0) {
    if (hasAnyForwardingHeader(headersList)) warnAboutClientIp("disabled");
    return null;
  }

  const xForwardedFor = headersList.get("x-forwarded-for");
  if (xForwardedFor === null) {
    if (hasAnyForwardingHeader(headersList)) warnAboutClientIp("missing-chain");
    return null;
  }

  const entries = xForwardedFor.split(",").map((entry) => entry.trim());
  if (entries.length < hopCount) {
    warnAboutClientIp("short-chain");
    return null;
  }

  const selectedEntry = entries[entries.length - hopCount];
  const clientIp = selectedEntry ? canonicalizeForwardedIp(selectedEntry) : null;
  if (!clientIp) warnAboutClientIp("invalid-selected-hop");

  return clientIp;
};

/** Read only the private identity established by Proxy; raw forwarding headers are never fallbacks. */
export async function getClientIpFromHeaders(): Promise<string> {
  let headersList: Headers;
  try {
    headersList = await headers();
  } catch (error) {
    logger.error(error, "Failed to get headers in getClientIpFromHeaders");
    return UNTRUSTED_CLIENT_IP;
  }

  const internalClientIp = headersList.get(FORMBRICKS_CLIENT_IP_HEADER);
  if (!internalClientIp) return UNTRUSTED_CLIENT_IP;

  return canonicalizeIp(internalClientIp) ?? UNTRUSTED_CLIENT_IP;
}
