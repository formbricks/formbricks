"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { PASSWORD_RESET_DISABLED, WEBAPP_URL } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

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

    // Only credential (email-identity) users have a password to reset; SSO users are silently skipped.
    // Better Auth's request endpoint is itself enumeration-safe, and we always return success below.
    if (user && user.identityProvider === "email") {
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
