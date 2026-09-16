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
 * Two residuals worth naming, so nobody reads this table as a stronger guarantee than it gives:
 *
 * - **azuread** emits no `email_verified` at all — not in its id_tokens, not from Graph's
 *   `/oidc/userinfo`. Its mapper falls back to `xms_edov`, Microsoft's own "is this address proven"
 *   claim, but that is OPTIONAL and off unless the tenant enables it on the app registration. On a
 *   default Entra setup nothing is asserted, so every sign-up resolves verified — the same as before
 *   this change. Entra's `email` is a mutable directory attribute, so that residual is real.
 * - **github** is `attested` on Better Auth's `/user/emails` lookup, which coalesces a FAILED lookup to
 *   the same `false` as a genuine denial (`emails?.find(...)?.verified ?? false`). A registration
 *   lacking the email permission therefore reads as "GitHub says unverified" for every user rather than
 *   "GitHub could not say" — noisy and over-strict, never over-permissive.
 */

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
 * OIDC types the claim as a boolean, but real IdPs serialise it in whatever their backend produces, so
 * a denial is recognised in the shapes it actually arrives in: the boolean, the string in any casing
 * (`"false"`, `"False"` from a Python-derived provider, `"FALSE"`), and the numeric forms `0` / `"0"`.
 * Matching only the exact boolean would fail OPEN on every one of those — an IdP saying "not verified"
 * in a spelling we did not anticipate would mint a verified account, which is precisely the bug class
 * this function exists to close. Nothing legitimate is lost by being broad here: no provider sends
 * `"False"` or `0` to mean verified.
 *
 * Affirmative spellings need no cases of their own — they are not denials, so they reach verified via
 * the default, which is the same place an absent claim lands.
 */
const DENIAL_CLAIM_VALUES: ReadonlySet<string> = new Set(["false", "0"]);

export const resolveEmailVerifiedFromRawClaim = (rawClaim: unknown): boolean => {
  if (rawClaim === false || rawClaim === 0) return false;
  if (typeof rawClaim === "string" && DENIAL_CLAIM_VALUES.has(rawClaim.trim().toLowerCase())) return false;
  return true;
};

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
