import "server-only";
import dns from "node:dns";
import { Agent } from "undici";
import { InvalidInputError } from "@formbricks/types/errors";
import { DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS } from "../constants";

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

const isPrivateIP = (ip: string, family: 4 | 6): boolean => {
  return family === 4 ? isPrivateIPv4(ip) : isPrivateIPv6(ip);
};

const DNS_TIMEOUT_MS = 3000;

export type ResolvedAddress = { ip: string; family: 4 | 6 };

const resolveHostnameToAddresses = (hostname: string): Promise<ResolvedAddress[]> => {
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
      const ipv4: ResolvedAddress[] = errV4 ? [] : ipv4Addresses.map((ip) => ({ ip, family: 4 as const }));

      dns.resolve6(hostname, (errV6, ipv6Addresses) => {
        const ipv6: ResolvedAddress[] = errV6 ? [] : ipv6Addresses.map((ip) => ({ ip, family: 6 as const }));
        const all = [...ipv4, ...ipv6];

        if (all.length === 0) {
          settle(reject, new Error(`DNS resolution failed for hostname: ${hostname}`));
        } else {
          settle(resolve, all);
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

const parseWebhookUrl = (url: string): URL => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidInputError("Invalid webhook URL format");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidInputError("Webhook URL must use HTTPS or HTTP protocol");
  }
  return parsed;
};

const validateIpLiteral = (hostname: string): ResolvedAddress | null => {
  const isIPv4Literal = IPV4_LITERAL.test(hostname);
  const isIPv6Literal = hostname.startsWith("[");
  if (!isIPv4Literal && !isIPv6Literal) return null;

  const ip = isIPv6Literal ? stripIPv6Brackets(hostname) : hostname;
  const family: 4 | 6 = isIPv4Literal ? 4 : 6;
  if (!DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS && isPrivateIP(ip, family)) {
    throw new InvalidInputError("Webhook URL must not point to private or internal IP addresses");
  }
  return { ip, family };
};

const resolveHostnameOrThrow = async (hostname: string): Promise<ResolvedAddress[]> => {
  try {
    return await resolveHostnameToAddresses(hostname);
  } catch (error) {
    const isTimeout = error instanceof Error && error.message.includes("timed out");
    throw new InvalidInputError(
      isTimeout
        ? `DNS resolution timed out for webhook URL hostname: ${hostname}`
        : `Could not resolve webhook URL hostname: ${hostname}`
    );
  }
};

/**
 * Validates a webhook URL and returns a resolved address pinned for delivery.
 *
 * Returns the IP literal or first DNS-resolved address. Returns `null` only when
 * `DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS` is enabled for a known internal hostname
 * (localhost etc.) — in that case the caller skips IP pinning so /etc/hosts works.
 *
 * Pinning the returned address into the fetch dispatcher closes the TOCTOU window
 * where DNS could rebind between this validation and the subsequent HTTP request.
 *
 * @throws {InvalidInputError} when the URL fails any validation check
 */
export const validateAndResolveWebhookUrl = async (url: string): Promise<ResolvedAddress | null> => {
  const parsed = parseWebhookUrl(url);
  const hostname = parsed.hostname;
  const isBlockedName = BLOCKED_HOSTNAMES.has(hostname.toLowerCase());

  if (!DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS && isBlockedName) {
    throw new InvalidInputError("Webhook URL must not point to localhost or internal services");
  }

  const literal = validateIpLiteral(hostname);
  if (literal) return literal;

  // Skip DNS for localhost-like hostnames when internal URLs are allowed (resolved via /etc/hosts)
  if (DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS && isBlockedName) {
    return null;
  }

  const resolved = await resolveHostnameOrThrow(hostname);

  if (!DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS) {
    for (const addr of resolved) {
      if (isPrivateIP(addr.ip, addr.family)) {
        throw new InvalidInputError("Webhook URL must not point to private or internal IP addresses");
      }
    }
  }

  // Pin to the first resolved address. All addresses already passed the public-IP
  // check above, so any choice is safe.
  return resolved[0];
};

/**
 * Validates a webhook URL to prevent Server-Side Request Forgery (SSRF).
 * Thin wrapper around {@link validateAndResolveWebhookUrl} for callers that only
 * need validation (e.g. webhook create/update) and discard the resolved address.
 *
 * @throws {InvalidInputError} when the URL fails any validation check
 */
export const validateWebhookUrl = async (url: string): Promise<void> => {
  await validateAndResolveWebhookUrl(url);
};

/**
 * Builds an undici Agent that pins outgoing TCP connections to the given IP/family,
 * regardless of what hostname the URL resolves to at fetch time. Use the address
 * returned by {@link validateAndResolveWebhookUrl} so the IP that was validated is
 * the IP that gets connected to — closes the DNS-rebinding TOCTOU window.
 *
 * TLS SNI/cert validation still uses the original hostname from the URL.
 */
export const createPinnedDispatcher = (address: ResolvedAddress): Agent => {
  return new Agent({
    connect: {
      // undici calls `lookup(host, { all: true, ... }, cb)`, so honor both forms:
      // when `all` is true we must return an array; otherwise the legacy
      // (err, address, family) signature. Returning the wrong form yields
      // "Invalid IP address: undefined" at connect time.
      lookup: (_hostname, options, callback) => {
        if (options && typeof options === "object" && (options as { all?: boolean }).all) {
          (
            callback as (
              err: NodeJS.ErrnoException | null,
              addresses: { address: string; family: number }[]
            ) => void
          )(null, [{ address: address.ip, family: address.family }]);
          return;
        }
        (callback as (err: NodeJS.ErrnoException | null, address: string, family: number) => void)(
          null,
          address.ip,
          address.family
        );
      },
    },
  });
};
