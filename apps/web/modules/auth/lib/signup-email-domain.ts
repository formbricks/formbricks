import "server-only";
import disposableEmailDomains from "disposable-email-domains/index.json";
import wildcardDisposableEmailDomains from "disposable-email-domains/wildcard.json";
import { IS_FORMBRICKS_CLOUD, SIGNUP_DOMAIN_CHECK_ON_INVITES } from "@/lib/constants";
import { PERSONAL_EMAIL_DOMAINS } from "./personal-email-domains";

/**
 * Blocklist of personal / free / disposable email domains, built once at module load.
 *
 * Union of two sources:
 *  - Free/personal providers (gmail, yahoo, outlook, …): a small curated list in
 *    ./personal-email-domains.ts that we expand as we go (its comment points at the full ~12.9k-domain
 *    `free-email-domains` list to vendor from if we ever want exhaustive coverage).
 *  - Disposable/burner providers (mailinator, 10minutemail, …): the `disposable-email-domains` npm
 *    package — kept comprehensive because burner domains are long-tail and churn constantly.
 *
 * Server-only: the disposable list alone is ~121k domains and must never be pulled into the client bundle.
 */
const normalizeDomains = (domains: readonly string[]) => domains.map((domain) => domain.trim().toLowerCase());

/**
 * Providers that hand every user their own subdomain (33mail: `alias@jerry.33mail.com`), so the
 * domain itself and any subdomain of it are blocked. Kept separate from the exact-match set so only
 * these ~400 entries widen to subdomains — `user@sub.gmail.com` stays allowed.
 */
const wildcardBlockedEmailDomains = new Set<string>(
  normalizeDomains(wildcardDisposableEmailDomains as string[])
);

const blockedEmailDomains = new Set<string>([
  ...normalizeDomains([...PERSONAL_EMAIL_DOMAINS, ...(disposableEmailDomains as string[])]),
  ...wildcardBlockedEmailDomains,
]);

/** Label count of the longest wildcard entry; no parent domain with more labels can match. */
const MAX_WILDCARD_LABELS = Math.max(
  ...Array.from(wildcardBlockedEmailDomains, (domain) => domain.split(".").length)
);

/**
 * True when a parent domain of `domain` (`a.b.33mail.com` → `33mail.com`, `b.33mail.com`) is a wildcard
 * entry. Walks from the right and stops after {@link MAX_WILDCARD_LABELS} labels, so the work stays
 * linear in the domain length: Better Auth's sign-up route and the SSO email claim don't cap it.
 */
const isSubdomainOfWildcardDomain = (domain: string): boolean => {
  let dotIndex = domain.length;
  for (let labels = 1; labels <= MAX_WILDCARD_LABELS; labels++) {
    dotIndex = domain.lastIndexOf(".", dotIndex - 1);
    if (dotIndex === -1) return false;
    if (wildcardBlockedEmailDomains.has(domain.slice(dotIndex + 1))) return true;
  }
  return false;
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
  // Strip trailing FQDN dots ("gmail.com." → "gmail.com") so they can't slip past the Set. Done with a
  // linear scan, not /\.+$/: that pattern backtracks super-linearly on adversarial input, and the SSO
  // email reaching this gate is not zod-validated.
  let end = normalized.length;
  while (end > atIndex + 1 && normalized[end - 1] === ".") end--;
  const domain = normalized.slice(atIndex + 1, end);
  return blockedEmailDomains.has(domain) || isSubdomainOfWildcardDomain(domain);
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
