import "server-only";
import {
  type AuthHookContext,
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";

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
  await blockedSignupDomainRedirectAfterHandler(ctx);
};
