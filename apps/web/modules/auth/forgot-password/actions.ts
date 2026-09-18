"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { EMAIL_AUTH_ENABLED, PASSWORD_RESET_DISABLED, WEBAPP_URL } from "@/lib/constants";
import { hasCredentialAccount } from "@/lib/user/password";
import { auth } from "@/modules/auth/lib/auth";
import { type SecurityActionAudit, runSecurityAction } from "@/modules/auth/lib/security-action-audit";
import { securityActionClient } from "@/modules/auth/lib/security-action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

/**
 * Whether this user has a password to reset. Pure SSO users do not, and are silently skipped — Better
 * Auth's request endpoint is enumeration-safe and the action always reports success either way.
 *
 * The second arm exists because SSO recovery is one-way (ENG-2557): completing it flips
 * `identityProvider` to the SSO provider and nothing ever flips it back, while the recovery also clears
 * the password it found. Gated on `identityProvider` alone, those users could never ask for a reset again
 * — locked to an IdP they might lose access to, with `auth.api.setPassword` being `serverOnly` and
 * unwired. The surviving credential `Account` row identifies them: recovery nulls the password, it does
 * not delete the row.
 *
 * Kept as narrow as that problem, deliberately: gating on the credential row rather than on
 * `emailVerified` means this action grants nothing to a user who has only ever signed in via SSO, and
 * `EMAIL_AUTH_ENABLED` switches the second arm off entirely on an SSO-only instance. Note that gate
 * covers only the second arm — an `identityProvider === "email"` user still receives reset mail on an
 * SSO-only instance, which is pre-existing behaviour this change deliberately leaves alone. So the flag
 * here is about not *widening* that surface, not about closing it.
 *
 * Both are belt-and-braces rather than the enforcement boundary, and it is worth not mistaking one for
 * the other. Better Auth's native `POST /api/auth/request-password-reset` is mounted by the `[...all]`
 * catch-all unconditionally — it is NOT gated on `emailAndPassword.enabled` — and its `resetPassword`
 * CREATES a credential row when none exists. So a password can be minted for any registered address
 * regardless of this action. What actually contains that is `/sign-in/email`, which IS gated, so a minted
 * password is unusable on an SSO-only instance. This relaxation therefore grants no reach that was not
 * already there; it just stops the UI lying to a recovered user.
 */
const canResetPassword = async (user: {
  id: string;
  identityProvider: IdentityProvider;
}): Promise<boolean> => {
  if (user.identityProvider === "email") {
    return true;
  }
  if (!EMAIL_AUTH_ENABLED) {
    return false;
  }

  try {
    return await hasCredentialAccount(user.id);
  } catch (error) {
    // Fail closed rather than letting this escape. Note the action's `{ success: true }` is not an
    // absolute invariant — `getUserByEmail` above it is unguarded and its `DatabaseError` is not an
    // expected error, so it surfaces as a server error. That is address-independent, so it is not an
    // enumeration oracle; this catch just avoids adding a second, narrower failure mode on a path that
    // only runs for non-email identity providers.
    logger.error({ error, userId: user.id }, "Credential-account lookup failed during password reset");
    return false;
  }
};

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
});

export const forgotPasswordAction = securityActionClient("password_reset_request")
  .inputSchema(ZForgotPasswordAction)
  .action(async ({ ctx, parsedInput }) => {
    const audit: SecurityActionAudit = {
      operation: "password_reset_request",
      source: "server-action",
      requestId: ctx.auditLoggingCtx.eventId,
    };
    return runSecurityAction(audit, async () => {
      await applyIPRateLimit(rateLimitConfigs.auth.forgotPassword);

      if (PASSWORD_RESET_DISABLED) {
        throw new OperationNotAllowedError("Password reset is disabled");
      }

      const user = await getUserByEmail(parsedInput.email);

      if (user && (await canResetPassword(user))) {
        // Target the audited event at the account the reset was requested for. The ACTOR stays
        // `UNKNOWN_DATA` because this action is unauthenticated by design — which is the honest record:
        // someone who knows the address asked for a reset.
        audit.target = { type: "user", id: user.id };
        try {
          await auth.api.requestPasswordReset({
            body: { email: user.email, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
            headers: await headers(),
          });
        } catch (error) {
          // Preserve the enumeration-safe response while recording the failed request.
          audit.status = "failure";
          logger.error({ error, userId: user.id }, "Password reset request failed");
        }
      } else {
        // An enumeration-safe response is not a completed reset or a sent message.
        audit.status = "noop";
      }

      audit.changes = { requestAccepted: audit.status !== "failure", passwordChanged: false };
      return { success: true };
    });
  });
