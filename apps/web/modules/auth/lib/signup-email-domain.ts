import "server-only";
import disposableEmailDomains from "disposable-email-domains/index.json";
import { IS_FORMBRICKS_CLOUD, SIGNUP_DOMAIN_CHECK_ON_INVITES } from "@/lib/constants";
import freeEmailDomains from "./vendor/free-email-domains.json";

/**
 * Blocklist of personal / free / disposable email domains, built once at module load.
 *
 * Union of two sources:
 *  - Free/personal providers (gmail, yahoo, outlook, …): vendored at ./vendor/free-email-domains.json.
 *    Vendored from the `free-email-domains` npm package (Kikobeats, HubSpot-derived) rather than
 *    depended on, because that package auto-publishes a new version daily and ships a postinstall
 *    script — an ongoing supply-chain surface we don't want. Regenerate the vendored file by
 *    installing `free-email-domains`, then normalizing its `domains.json` (trim → lowercase → dedupe → sort).
 *  - Disposable/burner providers (mailinator, 10minutemail, …): the `disposable-email-domains` npm
 *    package (stable, no install scripts).
 *
 * Server-only: the union is ~130k domains (~2.7MB) and must never be pulled into the client bundle.
 */
const blockedEmailDomains = new Set<string>(
  [...(freeEmailDomains as string[]), ...(disposableEmailDomains as string[])].map((domain) =>
    domain.trim().toLowerCase()
  )
);

/**
 * Pure predicate: is the email's domain a known personal/free/disposable provider?
 *
 * Environment-agnostic — callers apply the Cloud gate and invite exemption via
 * {@link isSignupEmailDomainBlocked}. Assumes the address has already passed email-format
 * validation; malformed input (no local part, no domain, multiple `@`) is treated as not-blocked.
 */
export const isBlockedEmailDomain = (email: string): boolean => {
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  // Reject empty local part ("@gmail.com"), missing domain ("test@") and no-`@` inputs.
  if (atIndex <= 0 || atIndex === normalized.length - 1) return false;
  return blockedEmailDomains.has(normalized.slice(atIndex + 1));
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
