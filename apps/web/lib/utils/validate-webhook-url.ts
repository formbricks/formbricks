import "server-only";
import dns from "node:dns";
import net from "node:net";
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

/**
 * Private, reserved and otherwise non-routable ranges that must never be a webhook target.
 *
 * Matched as CIDRs via `net.BlockList` rather than by regex or string prefix. The previous
 * regex/prefix classifier silently covered less than its own comments claimed — `/^224\./` and
 * `/^240\./` matched a /8 each while documenting a /4, the IPv6 prefix `"fe80:"` covered only
 * `fe80::/16` of the `fe80::/10` link-local range, and the CGNAT alternation matched second
 * octets 100-129, wrongly rejecting the public `100.128.0.0/15`. CIDR matching makes all of
 * those exact by construction.
 *
 * `BlockList` also normalizes IPv4-mapped IPv6 addresses (`::ffff:127.0.0.1`, the hex form
 * `::ffff:7f00:1`, uppercase, and uncompressed) against the IPv4 rules below, so mapped forms of
 * an internal address are covered without a hand-rolled unwrapping step.
 */
const BLOCKED_IPV4_SUBNETS: [address: string, prefix: number][] = [
  ["0.0.0.0", 8], // "this" network
  ["10.0.0.0", 8], // RFC 1918 private
  ["100.64.0.0", 10], // shared address space / CGNAT (RFC 6598) — Tailscale tailnets
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (AWS/GCP/Azure IMDS)
  ["172.16.0.0", 12], // RFC 1918 private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1 (documentation)
  ["192.168.0.0", 16], // RFC 1918 private
  ["198.18.0.0", 15], // benchmarking (RFC 2544)
  ["198.51.100.0", 24], // TEST-NET-2 (documentation)
  ["203.0.113.0", 24], // TEST-NET-3 (documentation)
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved for future use, incl. 255.255.255.255 broadcast
];

const BLOCKED_IPV4_ADDRESSES: string[] = [
  "168.63.129.16", // Azure WireServer — platform DNS/agent channel, outside 169.254.0.0/16
];

const BLOCKED_IPV6_SUBNETS: [address: string, prefix: number][] = [
  // ::/96 is the deprecated IPv4-compatible format and covers both ::  (unspecified) and ::1
  // (loopback). It does NOT collide with the IPv4-mapped range ::ffff:0:0/96, whose 6th group is
  // ffff — so mapped public addresses stay reachable while ::7f00:1 and ::a9fe:a9fe do not.
  ["::", 96], // IPv4-compatible IPv6, deprecated (::7f00:1 == 127.0.0.1); incl. :: and ::1
  // IPv4-translated (RFC 2765 / SIIT) is the sixth IPv4-wrapper format, alongside IPv4-mapped,
  // IPv4-compatible, NAT64, 6to4 and Teredo. Deprecated by RFC 4966 and absent from the IANA
  // special-purpose registry, so neither Node nor Go special-cases it. Its 5th group is ffff and
  // 6th is 0 — the mirror of IPv4-mapped — so it overlaps neither ::/96 nor ::ffff:0:0/96, and
  // mapped public addresses stay reachable.
  ["::ffff:0:0:0", 96], // IPv4-translated IPv6, deprecated (::ffff:0:7f00:1 == 127.0.0.1)
  ["64:ff9b::", 96], // NAT64 well-known (64:ff9b::a9fe:a9fe == 169.254.169.254)
  ["64:ff9b:1::", 48], // NAT64 local-use (RFC 8215)
  ["100::", 64], // discard-only (RFC 6666)
  ["2001::", 32], // Teredo — tunnels IPv4 the same way 6to4 does
  ["2001:db8::", 32], // documentation (RFC 3849)
  ["2002::", 16], // 6to4 (2002:7f00:1::1 == 127.0.0.1)
  ["fc00::", 7], // unique local addresses (ULA)
  ["fe80::", 10], // link-local — the whole /10, not just fe80::/16
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast, every scope
];

const buildBlockList = (): net.BlockList => {
  const list = new net.BlockList();

  for (const [address, prefix] of BLOCKED_IPV4_SUBNETS) {
    list.addSubnet(address, prefix, "ipv4");
  }
  for (const address of BLOCKED_IPV4_ADDRESSES) {
    list.addAddress(address, "ipv4");
  }
  for (const [address, prefix] of BLOCKED_IPV6_SUBNETS) {
    list.addSubnet(address, prefix, "ipv6");
  }

  return list;
};

const blockedAddresses = buildBlockList();

/**
 * Returns true when `ip` must not be used as a webhook target.
 *
 * The family is taken from parsing `ip` rather than from the caller, so a mismatch between the two
 * cannot pick the wrong rule set — checking an IPv4 address against the IPv6 rules would report it
 * as allowed. Unparseable input is rejected for the same reason: `BlockList.check()` reports it as
 * *not* blocked, so anything we cannot classify has to fail closed here.
 */
const isPrivateIP = (ip: string): boolean => {
  const version = net.isIP(ip);
  if (version === 0) return true;

  return blockedAddresses.check(ip, version === 4 ? "ipv4" : "ipv6");
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

/**
 * Classifies an IP-literal host, or returns null when the host is a name to resolve via DNS.
 *
 * `net.isIP` decides the family instead of a dotted-quad regex: the URL parser has already
 * normalized the alternative IPv4 notations (`0x7f000001`, `2130706433`, `0177.0.0.1`, `127.1` all
 * arrive here as `127.0.0.1`) and rejected malformed ones, so this only has to tell a valid
 * literal from a hostname.
 */
const validateIpLiteral = (hostname: string): ResolvedAddress | null => {
  const ip = stripIPv6Brackets(hostname);
  const version = net.isIP(ip);
  if (version === 0) return null;

  const family: 4 | 6 = version === 4 ? 4 : 6;
  if (!DANGEROUSLY_ALLOW_WEBHOOK_INTERNAL_URLS && isPrivateIP(ip)) {
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
      if (isPrivateIP(addr.ip)) {
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
