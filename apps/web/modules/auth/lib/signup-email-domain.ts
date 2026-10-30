import "server-only";
import { domainToASCII } from "node:url";
import { IS_FORMBRICKS_CLOUD, SIGNUP_DOMAIN_CHECK_ON_INVITES } from "@/lib/constants";
import allowedEmailDomains from "./email-domain-lists/allowed-domains.json";
import blockedEmailDomainAdditions from "./email-domain-lists/blocked-domains.json";
import disposableEmailDomains from "./email-domain-lists/disposable-domains.json";
import freeProviderEmailDomains from "./email-domain-lists/free-provider-domains.json";

/**
 * Personal / free / disposable email domains, built once at module load from ./email-domain-lists
 * (see its README):
 *  - free-provider-domains.json and disposable-domains.json are generated from upstream lists by
 *    scripts/email-domain-lists/refresh.mjs, which a weekly workflow runs and opens a PR from.
 *  - blocked-domains.json adds what upstream misses; allowed-domains.json overrides everything.
 *
 * Every entry also blocks its subdomains: providers hand out per-user subdomains (33mail:
 * `alias@jerry.33mail.com`), and the disposable lists expect consumers to match them. The refresh
 * script drops public suffixes so no entry widens to a whole namespace.
 *
 * Server-only: ~56k domains that must never be pulled into the client bundle.
 */
type TEmailDomainListEntry = { domain: string; reason: string };

// Typed explicitly: TypeScript infers `never[]` for a JSON file holding an empty array.
const blockedEntries: readonly TEmailDomainListEntry[] = blockedEmailDomainAdditions;
const allowedEntries: readonly TEmailDomainListEntry[] = allowedEmailDomains;

const blockedEmailDomains = new Set<string>([
  ...freeProviderEmailDomains,
  ...disposableEmailDomains,
  ...blockedEntries.map((entry) => entry.domain),
]);
const allowedEmailDomainSet = new Set<string>(allowedEntries.map((entry) => entry.domain));

/** Label count of the longest entry; no parent domain with more labels can match. */
const MAX_ENTRY_LABELS = Math.max(
  ...Array.from([...blockedEmailDomains, ...allowedEmailDomainSet], (domain) => domain.split(".").length)
);

/**
 * True when `domain` or a parent of it (`a.b.33mail.com` → `33mail.com`) is in `domains`. Walks from
 * the right and stops after {@link MAX_ENTRY_LABELS} labels, so the work stays linear in the domain
 * length: Better Auth's sign-up route and the SSO email claim don't cap it.
 */
const isDomainOrParentIn = (domain: string, domains: ReadonlySet<string>): boolean => {
  if (domains.has(domain)) return true;
  let dotIndex = domain.length;
  for (let labels = 1; labels <= MAX_ENTRY_LABELS; labels++) {
    dotIndex = domain.lastIndexOf(".", dotIndex - 1);
    if (dotIndex === -1) return false;
    if (domains.has(domain.slice(dotIndex + 1))) return true;
  }
  return false;
};

/**
 * Maps an internationalized domain to the ASCII form the lists use, so full-width or otherwise
 * equivalent Unicode spellings (`ｇｍａｉｌ.com`) can't slip past them. Plain-ASCII input skips the
 * conversion; if it fails, the lowercase input is checked as-is rather than allowed outright.
 */
const toAsciiDomain = (domain: string): string => {
  // eslint-disable-next-line no-control-regex -- matching any non-ASCII code point is the point here
  if (!/[^\x00-\x7f]/.test(domain)) return domain;
  return domainToASCII(domain) || domain;
};

/**
 * Pure predicate: is the email's domain a known personal/free/disposable provider?
 *
 * Environment-agnostic — callers apply the Cloud gate and invite exemption via
 * {@link isSignupEmailDomainBlocked}. Assumes the address has already passed email-format
 * validation; malformed or absent input (missing/empty address, empty local part, empty domain) is
 * treated as not-blocked, so an unexpected caller degrades to "allow" rather than throwing.
 */
export const isBlockedEmailDomain = (email: string): boolean => {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  // Reject empty local part ("@gmail.com"), missing domain ("test@") and no-`@` inputs.
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false;
  const asciiDomain = toAsciiDomain(normalized.slice(atIndex + 1));
  // Strip trailing FQDN dots ("gmail.com." → "gmail.com") so they can't slip past the Set. Done with a
  // linear scan, not /\.+$/: that pattern backtracks super-linearly on adversarial input, and the SSO
  // email reaching this gate is not zod-validated. After the ASCII mapping, which turns "。" into ".".
  let end = asciiDomain.length;
  while (end > 0 && asciiDomain[end - 1] === ".") end--;
  const domain = asciiDomain.slice(0, end);
  // The allowlist wins, but it only matters for a domain that is blocked, so it is checked second.
  if (!domain || !isDomainOrParentIn(domain, blockedEmailDomains)) return false;
  return !isDomainOrParentIn(domain, allowedEmailDomainSet);
};

/**
 * Sign-up policy: should this email be blocked from creating a new account?
 *
 * - Enforced only on Formbricks Cloud (`IS_FORMBRICKS_CLOUD`); self-hosted is never affected.
 * - Invited users are exempt unless the `SIGNUP_DOMAIN_CHECK_ON_INVITES` kill-switch is enabled.
 *   The exemption is decided by a caller-supplied check (a validated invite token whose email
 *   matches the address), invoked lazily so the token/DB work only runs when the domain is
 *   actually blocked and invites are actually exempt.
 *
 * @param email - the address being registered
 * @param hasValidMatchingInvite - lazy async predicate; resolves true when a valid invite matches this email
 */
export const isSignupEmailDomainBlocked = async (
  email: string,
  hasValidMatchingInvite: () => Promise<boolean>
): Promise<boolean> => {
  if (!IS_FORMBRICKS_CLOUD) return false;
  if (!isBlockedEmailDomain(email)) return false;
  if (!SIGNUP_DOMAIN_CHECK_ON_INVITES && (await hasValidMatchingInvite())) return false;
  return true;
};
