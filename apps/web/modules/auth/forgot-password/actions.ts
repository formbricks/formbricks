"use server";

import { headers } from "next/headers";
import { z } from "zod";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { EMAIL_AUTH_ENABLED, PASSWORD_RESET_DISABLED, WEBAPP_URL } from "@/lib/constants";
import { hasCredentialAccount } from "@/lib/user/password";
import { actionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";
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
 * Kept as narrow as that problem, deliberately. Gating on the credential row rather than on
 * `emailVerified` means a user who has ONLY ever signed in via SSO has no such row and gains nothing here,
 * and `EMAIL_AUTH_ENABLED` switches the second arm off entirely on an SSO-only instance — where handing
 * back a password would be the "sign in around the IdP, and around whatever the IdP enforces" bypass that
 * turning `emailAndPassword.enabled` off exists to prevent.
 */
const canResetPassword = async (user: { id: string; identityProvider: IdentityProvider }): Promise<boolean> =>
  user.identityProvider === "email" || (EMAIL_AUTH_ENABLED && (await hasCredentialAccount(user.id)));

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
});

export const forgotPasswordAction = actionClient
  .inputSchema(ZForgotPasswordAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.forgotPassword);

    if (PASSWORD_RESET_DISABLED) {
      throw new OperationNotAllowedError("Password reset is disabled");
    }

    const user = await getUserByEmail(parsedInput.email);

    if (user && (await canResetPassword(user))) {
      try {
        await auth.api.requestPasswordReset({
          body: { email: user.email, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
          headers: await headers(),
        });
      } catch (error) {
        logger.error({ error, userId: user.id }, "Password reset request failed");
      }
    }

    return { success: true };
  });
