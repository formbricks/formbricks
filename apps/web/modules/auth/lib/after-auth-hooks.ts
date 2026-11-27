import "server-only";
import {
  type AuthHookContext,
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { settleSignInBudgetAfterHandler } from "./better-auth-sign-in-budget";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";
import { maskUnverifiedSignInAfterHandler } from "./better-auth-unverified-sign-in";
import { verificationAutoSignInAfterHandler } from "./better-auth-verification-autosignin";
import { revokeTokensBeyondConsentAfterHandler } from "./oauth-grant-revocation";
import { requireOAuthConsentOnRefreshAfterHandler } from "./oauth-refresh-check";

/**
 * Composed Better Auth `hooks.after` chain. Ordering rationale: `auditFailedAuthAfter` runs before
 * `blockedSignupDomainRedirectAfterHandler` because the latter throws `ctx.redirect(...)` on a
 * personal-email SSO rejection, which short-circuits anything composed after it. Today
 * `auditFailedAuthAfter` only records `/sign-in/email` failures, so a `/callback` SSO rejection no-ops
 * it regardless of order — keeping it first is deliberate future-proofing: if the failed-auth audit is
 * ever extended to SSO callback paths, it must still fire before the redirect throws.
 * `ssoRecoveryAfterHandler` runs first (its account-not-linked redirect also throws, and is mutually
 * exclusive with the personal-email one). `maskUnverifiedSignInAfterHandler` comes last: it replaces the
 * response, and the audit and the sign-in budget before it must see the real
 * `EMAIL_NOT_VERIFIED` code (ENG-2099). Extracted from auth.ts so the order is unit-testable.
 */
export const runAfterAuthHooks = async (ctx: AuthHookContext): Promise<Response | undefined> => {
  await ssoRecoveryAfterHandler(ctx);
  await auditFailedAuthAfter(ctx);
  // SEC-18: give back the sign-in budget unit unless the credentials failed (ENG-2099: unverified counts).
  await settleSignInBudgetAfterHandler(ctx);
  // ENG-1824: heal legacy 2FA enrollments (no `TwoFactor` row) on successful password sign-in, before
  // the 2FA challenge. Only touches `/sign-in/email`, so it's unaffected by the SSO-only redirect below.
  await twoFactorBackfillAfterHandler(ctx);
  // ENG-2562: mint the post-verification session only for the browser that signed up. Only touches
  // `/verify-email`, so it is order-independent with respect to the SSO redirects above — placed last
  // because it is the only handler here that adds a session rather than inspecting one.
  await verificationAutoSignInAfterHandler(ctx);
  // ENG-2499 / ENG-3529: a refresh whose consent was revoked, or narrowed below the token's scopes, is
  // refused and the tokens beyond the consent revoked; narrowing a consent revokes them right away. Only
  // touch `/oauth2/token`, `/oauth2/consent` and `/oauth2/update-consent`, so they are order-independent
  // with respect to the SSO redirect below.
  await requireOAuthConsentOnRefreshAfterHandler(ctx);
  await revokeTokensBeyondConsentAfterHandler(ctx);
  await blockedSignupDomainRedirectAfterHandler(ctx);
  // ENG-2099: a correct password on an unverified account answers like every other failed sign-in. Only
  // touches `/sign-in/email`, so it is path-disjoint from the SSO redirect above; last because the response
  // it returns replaces the request's.
  return maskUnverifiedSignInAfterHandler(ctx);
};
