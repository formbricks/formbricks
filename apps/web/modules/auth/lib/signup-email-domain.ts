import "server-only";
import disposableEmailDomains from "disposable-email-domains/index.json";
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
const blockedEmailDomains = new Set<string>(
  [...PERSONAL_EMAIL_DOMAINS, ...(disposableEmailDomains as string[])].map((domain) =>
    domain.trim().toLowerCase()
  )
);

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
  return blockedEmailDomains.has(domain);
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
