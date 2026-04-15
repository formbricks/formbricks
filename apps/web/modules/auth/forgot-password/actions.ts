"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { requestPasswordReset } from "@/modules/auth/forgot-password/lib/password-reset-service";
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

    if (user && user.identityProvider === "email") {
      try {
        await requestPasswordReset(user, "public");
      } catch (error) {
        logger.error({ error, stage: "dispatch", userId: user.id }, "Password reset request failed");
      }
    }

    return { success: true };
  });
