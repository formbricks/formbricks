"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { OperationNotAllowedError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { PASSWORD_RESET_DISABLED } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { processPasswordResetRequest } from "@/modules/auth/forgot-password/lib/password-reset-request";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZForgotPasswordAction = z.object({
  email: ZUserEmail,
});

/**
 * Request a password reset. Enumeration-safe by construction (ENG-3639): before it responds it does only
 * what is the same for every address — the IP limit and the operator's kill switch — and hands the rest
 * (lookup, reset link or SSO hint, per-account limit, audit) to `after()`. So neither the answer nor how
 * long it takes depends on whether the address is registered, has a password, or was just throttled.
 */
export const forgotPasswordAction = actionClient.inputSchema(ZForgotPasswordAction).action(
  withAuditLogging("passwordReset", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.forgotPassword);

    if (PASSWORD_RESET_DISABLED) {
      throw new OperationNotAllowedError("Password reset is disabled");
    }

    // The success event is recorded by `processPasswordResetRequest`, and only when a reset was really
    // requested; the wrapper cannot know that by the time it logs. A thrown failure above is still
    // audited by the wrapper, which suppression never hides.
    ctx.auditLoggingCtx.suppressEvent = true;

    // Copied while the request is live: Better Auth's hooks read them after the response has gone.
    const requestHeaders = new Headers(await headers());
    const { ipAddress } = ctx.auditLoggingCtx;
    after(() => processPasswordResetRequest({ email: parsedInput.email, requestHeaders, ipAddress }));

    return { success: true };
  })
);
