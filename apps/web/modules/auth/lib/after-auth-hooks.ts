import "server-only";
import {
  type AuthHookContext,
  blockedSignupDomainRedirectAfterHandler,
  ssoRecoveryAfterHandler,
} from "@/modules/ee/sso/lib/better-auth-hooks";
import { auditFailedAuthAfter } from "./better-auth-observability";

/**
 * Composed Better Auth `hooks.after` chain. The order is load-bearing: `auditFailedAuthAfter` MUST run
 * before `blockedSignupDomainRedirectAfterHandler`, because the latter throws `ctx.redirect(...)` on a
 * personal-email SSO rejection — if it ran first, the failed-auth audit would be skipped on every such
 * rejection. `ssoRecoveryAfterHandler` runs first (its account-not-linked redirect also throws, and is
 * mutually exclusive with the personal-email one). Extracted from auth.ts so the order is unit-testable.
 */
export const runAfterAuthHooks = async (ctx: AuthHookContext): Promise<void> => {
  await ssoRecoveryAfterHandler(ctx);
  await auditFailedAuthAfter(ctx);
  await blockedSignupDomainRedirectAfterHandler(ctx);
};
