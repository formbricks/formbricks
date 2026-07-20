import "server-only";
import {
  type AuthHookContext,
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";
import { twoFactorBackfillAfterHandler } from "./better-auth-two-factor-backfill";

/**
 * Composed Better Auth `hooks.after` chain. Ordering rationale: `auditFailedAuthAfter` runs before
 * `blockedSignupDomainRedirectAfterHandler` because the latter throws `ctx.redirect(...)` on a
 * personal-email SSO rejection, which short-circuits anything composed after it. Today
 * `auditFailedAuthAfter` only records `/sign-in/email` failures, so a `/callback` SSO rejection no-ops
 * it regardless of order — keeping it first is deliberate future-proofing: if the failed-auth audit is
 * ever extended to SSO callback paths, it must still fire before the redirect throws.
 * `ssoRecoveryAfterHandler` runs first (its account-not-linked redirect also throws, and is mutually
 * exclusive with the personal-email one). Extracted from auth.ts so the order is unit-testable.
 */
export const runAfterAuthHooks = async (ctx: AuthHookContext): Promise<void> => {
  await ssoRecoveryAfterHandler(ctx);
  await auditFailedAuthAfter(ctx);
  // ENG-1824: heal legacy 2FA enrollments (no `TwoFactor` row) on successful password sign-in, before
  // the 2FA challenge. Only touches `/sign-in/email`, so it's unaffected by the SSO-only redirect below.
  await twoFactorBackfillAfterHandler(ctx);
  await blockedSignupDomainRedirectAfterHandler(ctx);
};
