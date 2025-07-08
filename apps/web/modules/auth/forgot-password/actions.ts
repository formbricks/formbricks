"use server";

import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { sendForgotPasswordEmail } from "@/modules/email";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
});

export const forgotPasswordAction = actionClient
  .schema(ZForgotPasswordAction)
  .action(async ({ parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.forgotPassword);

    if (PASSWORD_RESET_DISABLED) {
      throw new OperationNotAllowedError("Password reset is disabled");
    }

    const user = await getUserByEmail(parsedInput.email);

    if (user && user.identityProvider === "email") {
      await sendForgotPasswordEmail(user);
    }

    return { success: true };
  });
