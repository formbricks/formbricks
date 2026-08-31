import type { TSsoIdentityProvider } from "./provider-normalization";

/**
 * How much an SSO provider's `email_verified` signal can be trusted (ENG-2589).
 *
 * `emailVerified` is what the app treats as proof the account holder controls the address, so minting
 * it for an address the identity provider itself calls unproven hands a squatter a verified account on
 * someone else's email. But the providers do not all carry the same signal, and Better Auth flattens
 * that difference away before our hooks see it — hence a per-provider policy rather than one rule.
 *
 * - `attested` — Better Auth derives a real assertion from the provider and hands it to
 *   `user.create.before` as `user.emailVerified`, so the hook honours it strictly. Google reads
 *   `email_verified` off the id_token; GitHub looks the address up on `/user/emails`, which carries a
 *   `verified` flag precisely because unverified addresses exist on an account. GitHub's value is only
 *   available this late — Better Auth computes it AFTER `mapProfileToUser` runs — which is why the
 *   decision cannot live entirely in the provider mappers.
 * - `raw-claim` — the decision is made in `mapProfileToUser` (see `./better-auth-providers`), from the
 *   raw `email_verified` claim, because Better Auth's own value is useless here: the generic-OAuth
 *   userinfo path coalesces `email_verified ?? false`, which makes "the IdP did not say" indis-
 *   tinguishable from "the IdP asserted false". A mapper-returned `emailVerified` spreads last over
 *   Better Auth's, so it is authoritative, and the hook then passes it through untouched.
 * - `never-attests` — the provider cannot carry the claim at all, so there is nothing to honour and the
 *   row is verified as it always has been. SAML is permanent here: the BoxyHQ bridge's userinfo shape
 *   has no `email_verified` field, and the provider requests no `openid` scope, so Jackson never mints
 *   an id_token one could appear in.
 */
export type TSsoEmailVerificationTrust = "attested" | "raw-claim" | "never-attests";

/**
 * Exhaustive by construction: `TSsoIdentityProvider` is the closed SSO subset of the Prisma enum, so a
 * new provider fails typecheck here until someone decides how far to trust its claim.
 */
export const SSO_EMAIL_VERIFICATION_TRUST: Record<TSsoIdentityProvider, TSsoEmailVerificationTrust> = {
  google: "attested",
  github: "attested",
  azuread: "raw-claim",
  openid: "raw-claim",
  saml: "never-attests",
};

/**
 * Resolve a provider's RAW `email_verified` claim, for the `raw-claim` providers whose mappers read it
 * straight off the profile (ENG-2589).
 *
 * Deliberately asymmetric, and this is the whole point of reading the raw claim rather than Better
 * Auth's coalesced value:
 *
 * - asserted `false` → NOT verified. This is the case the ticket exists for: an IdP that permits
 *   self-registration with an unverified address must not yield a verified Formbricks account.
 * - asserted `true` → verified.
 * - **absent → verified.** An IdP that never sends the claim is not asserting anything, and treating
 *   its silence as a denial would flip every new user to unverified on upgrade for any self-hosted
 *   instance whose IdP omits it — a behaviour change we do not inflict on self-hosters to fix a case
 *   they are not in. Microsoft Graph's `/oidc/userinfo` omits it for most tenants, so this is the
 *   common path, not a corner.
 *
 * The string `"false"` is denied alongside the boolean: OIDC types the claim as a boolean, but real
 * IdPs have been observed serialising it as a string, and deny is the safe direction to guess in. A
 * string `"true"` needs no special case — it is not a denial, so it lands on verified via the default.
 */
export const resolveEmailVerifiedFromRawClaim = (rawClaim: unknown): boolean =>
  !(rawClaim === false || rawClaim === "false");

/**
 * The value written to `User.emailVerified` on SSO sign-up — the last decision before the INSERT, made
 * in `user.create.before` (see `./better-auth-hooks`).
 *
 * `attested` and `raw-claim` both resolve to "honour what reached us", differing only in WHERE the
 * claim was read: Better Auth computed it for the attested pair, our own mapper computed it for the
 * raw-claim pair, and either way it arrives here as `user.emailVerified`. Strictly `=== true`, so an
 * absent or malformed value is never mistaken for attestation — the `raw-claim` mappers have already
 * turned a genuinely absent claim into `true` by then, so nothing is lost by being strict here.
 */
export const resolveSsoEmailVerifiedForCreate = (
  provider: TSsoIdentityProvider,
  betterAuthEmailVerified: boolean | undefined
): boolean =>
  SSO_EMAIL_VERIFICATION_TRUST[provider] === "never-attests" ? true : betterAuthEmailVerified === true;
