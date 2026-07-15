"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  InvalidInputError,
  InvalidPasswordResetTokenError,
  OperationNotAllowedError,
  PASSWORD_COMPROMISED_ERROR_CODE,
} from "@formbricks/types/errors";
import { ZUserPassword } from "@formbricks/types/user";
import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { auth } from "@/modules/auth/lib/auth";
import { isPasswordCompromisedError } from "@/modules/auth/lib/better-auth-hibp";

const ZResetPasswordAction = z.object({
  token: z.string().min(1),
  password: ZUserPassword,
});

export const resetPasswordAction = actionClient
  .inputSchema(ZResetPasswordAction)
  .action(async ({ parsedInput }) => {
    if (PASSWORD_RESET_DISABLED) {
      throw new OperationNotAllowedError("Password reset is disabled");
    }

    try {
      await auth.api.resetPassword({
        body: { token: parsedInput.token, newPassword: parsedInput.password },
        headers: await headers(),
      });
    } catch (error) {
      // A breached password is rejected by the HIBP plugin with its own APIError — surface it as the
      // stable compromised-password code (the reset form maps it to a localized message). This MUST
      // precede the catch-all below, which would otherwise mislabel it as an invalid/expired token.
      if (isPasswordCompromisedError(error)) {
        throw new InvalidInputError(PASSWORD_COMPROMISED_ERROR_CODE);
      }
      // Better Auth rejects an invalid/expired/already-used token with an APIError; surface it as the
      // existing invalid-reset-token error so the form shows the same message. The post-reset side
      // effects — session revocation (revokeSessionsOnPasswordReset), the security notification email,
      // and the audit event (onPasswordReset) — are all handled inside Better Auth / auth.ts.
      if (isAPIError(error)) {
        throw new InvalidPasswordResetTokenError(
          INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
          "invalid_or_expired"
        );
      }
      throw error;
    }

    return { success: true };
  });
