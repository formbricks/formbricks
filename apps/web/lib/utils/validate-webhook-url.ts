import "server-only";
import dns from "node:dns";
import { InvalidInputError } from "@formbricks/types/errors";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",
]);

const PRIVATE_IPV4_PATTERNS: RegExp[] = [
  /^127\./, // 127.0.0.0/8 – Loopback
  /^10\./, // 10.0.0.0/8 – Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 – Class B private
  /^192\.168\./, // 192.168.0.0/16 – Class C private
  /^169\.254\./, // 169.254.0.0/16 – Link-local (AWS/GCP/Azure metadata)
  /^0\./, // 0.0.0.0/8 – "This" network
  /^100\.(6[4-9]|[7-9]\d|1[0-2]\d)\./, // 100.64.0.0/10 – Shared address space (RFC 6598)
  /^192\.0\.0\./, // 192.0.0.0/24 – IETF protocol assignments
  /^192\.0\.2\./, // 192.0.2.0/24 – TEST-NET-1 (documentation)
  /^198\.51\.100\./, // 198.51.100.0/24 – TEST-NET-2 (documentation)
  /^203\.0\.113\./, // 203.0.113.0/24 – TEST-NET-3 (documentation)
  /^198\.1[89]\./, // 198.18.0.0/15 – Benchmarking
  /^224\./, // 224.0.0.0/4 – Multicast
  /^240\./, // 240.0.0.0/4 – Reserved for future use
  /^255\.255\.255\.255$/, // Limited broadcast
];

const PRIVATE_IPV6_PREFIXES = [
  "::1", // Loopback
  "fe80:", // Link-local
  "fc", // Unique local address (ULA, fc00::/7 — covers fc00:: through fdff::)
  "fd", // Unique local address (ULA, fc00::/7 — covers fc00:: through fdff::)
];

const isPrivateIPv4 = (ip: string): boolean => {
  return PRIVATE_IPV4_PATTERNS.some((pattern) => pattern.test(ip));
};

const hexMappedToIPv4 = (hexPart: string): string | null => {
  const groups = hexPart.split(":");
  if (groups.length !== 2) return null;
  const high = Number.parseInt(groups[0], 16);
  const low = Number.parseInt(groups[1], 16);
  if (Number.isNaN(high) || Number.isNaN(low) || high > 0xffff || low > 0xffff) return null;
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
};

const isIPv4Mapped = (normalized: string): boolean => {
  if (!normalized.startsWith("::ffff:")) return false;
  const suffix = normalized.slice(7); // strip "::ffff:"

  if (suffix.includes(".")) {
    return isPrivateIPv4(suffix);
  }
  const dotted = hexMappedToIPv4(suffix);
  return dotted !== null && isPrivateIPv4(dotted);
};

const isPrivateIPv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === "::") return true;
  if (isIPv4Mapped(normalized)) return true;
  return PRIVATE_IPV6_PREFIXES.some((prefix) => normalized.startsWith(prefix));
};

const isPrivateIP = (ip: string): boolean => {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip);
};

const DNS_TIMEOUT_MS = 3000;

const resolveHostnameToIPs = (hostname: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    let settled = false;

    const settle = <T>(fn: (value: T) => void, value: T): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const timer = setTimeout(() => {
      settle(reject, new Error(`DNS resolution timed out for hostname: ${hostname}`));
    }, DNS_TIMEOUT_MS);

    dns.resolve(hostname, (errV4, ipv4Addresses) => {
      const ipv4 = errV4 ? [] : ipv4Addresses;

      dns.resolve6(hostname, (errV6, ipv6Addresses) => {
        const ipv6 = errV6 ? [] : ipv6Addresses;
        const allAddresses = [...ipv4, ...ipv6];

        if (allAddresses.length === 0) {
          settle(reject, new Error(`DNS resolution failed for hostname: ${hostname}`));
        } else {
          settle(resolve, allAddresses);
        }
      });
    });
  });
};

const stripIPv6Brackets = (hostname: string): string => {
  if (hostname.startsWith("[") && hostname.endsWith("]")) {
    return hostname.slice(1, -1);
  }
  return hostname;
};

const IPV4_LITERAL = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Validates a webhook URL to prevent Server-Side Request Forgery (SSRF).
 *
 * Checks performed:
 * 1. URL must be well-formed
 * 2. Protocol must be HTTPS or HTTP
 * 3. Hostname must not be a known internal name (localhost, metadata endpoints)
 * 4. IP literal hostnames are checked directly against private ranges
 * 5. Domain hostnames are resolved via DNS; all resulting IPs must be public
 *
 * @throws {InvalidInputError} when the URL fails any validation check
 */
export const validateWebhookUrl = async (url: string): Promise<void> => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidInputError("Invalid webhook URL format");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidInputError("Webhook URL must use HTTPS or HTTP protocol");
  }

  const hostname = parsed.hostname;

  if (BLOCKED_HOSTNAMES.has(hostname.toLowerCase())) {
    throw new InvalidInputError("Webhook URL must not point to localhost or internal services");
  }

  // Direct IP literal — validate without DNS resolution
  const isIPv4Literal = IPV4_LITERAL.test(hostname);
  const isIPv6Literal = hostname.startsWith("[");

  if (isIPv4Literal || isIPv6Literal) {
    const ip = isIPv6Literal ? stripIPv6Brackets(hostname) : hostname;
    if (isPrivateIP(ip)) {
      throw new InvalidInputError("Webhook URL must not point to private or internal IP addresses");
    }
    return;
  }

  // Domain name — resolve DNS and validate every resolved IP
  let resolvedIPs: string[];
  try {
    resolvedIPs = await resolveHostnameToIPs(hostname);
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes("timed out");
    throw new InvalidInputError(
      isTimeout
        ? `DNS resolution timed out for webhook URL hostname: ${hostname}`
        : `Could not resolve webhook URL hostname: ${hostname}`
    );
  }

  for (const ip of resolvedIPs) {
    if (isPrivateIP(ip)) {
      throw new InvalidInputError("Webhook URL must not point to private or internal IP addresses");
    }
  }
};
