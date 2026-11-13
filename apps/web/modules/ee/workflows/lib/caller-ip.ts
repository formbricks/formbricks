// The caller IP of a Webhook call is stored in the rate limiter's canonical form
// (`lib/utils/client-ip.ts`): IPv4 as is, IPv6 fully expanded and cut to its /64 network. This turns
// that into what a person can read.

/** Matches `CLIENT_IP_IPV6_SUBNET_PREFIX` in `lib/utils/client-ip.ts` (not imported: it is server-only). */
const STORED_IPV6_PREFIX = 64;

const IPV6_GROUP = /^[0-9a-f]{1,4}$/i;

export type TCallerIpDisplay = { kind: "unknown" } | { kind: "address"; text: string };

const expandIpv6 = (value: string): number[] | null => {
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string | undefined) => (part ? part.split(":") : []);
  const left = toGroups(halves[0]);
  const right = toGroups(halves[1]);
  const missing = 8 - left.length - right.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...left, ...Array<string>(halves.length === 1 ? 0 : missing).fill("0"), ...right];
  if (!groups.every((group) => IPV6_GROUP.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16));
};

// RFC 5952: no leading zeros, the first longest run of two or more zero groups becomes "::".
const compressIpv6 = (groups: number[]): string => {
  let bestStart = -1;
  let bestLength = 1;
  let runStart = -1;
  groups.forEach((group, index) => {
    if (group !== 0) {
      runStart = -1;
      return;
    }
    if (runStart === -1) runStart = index;
    const length = index - runStart + 1;
    if (length > bestLength) {
      bestStart = runStart;
      bestLength = length;
    }
  });
  const hex = groups.map((group) => group.toString(16));
  if (bestStart === -1) return hex.join(":");
  return `${hex.slice(0, bestStart).join(":")}::${hex.slice(bestStart + bestLength).join(":")}`;
};

/**
 * How to show a stored caller IP: IPv4 as is, IPv6 compressed with its "/64", and a missing or
 * all-zeros value (a call from this machine, whose ::1 is cut to zeros) as unknown.
 */
export const formatCallerIp = (ip: string | null | undefined): TCallerIpDisplay => {
  if (!ip) return { kind: "unknown" };
  if (ip === "0.0.0.0") return { kind: "unknown" };
  if (!ip.includes(":")) return { kind: "address", text: ip };

  const groups = expandIpv6(ip);
  if (!groups) return { kind: "address", text: ip };
  if (groups.every((group) => group === 0)) return { kind: "unknown" };
  return { kind: "address", text: `${compressIpv6(groups)}/${STORED_IPV6_PREFIX}` };
};
