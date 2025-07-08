"use server";

import { actionClient } from "@/lib/utils/action-client";
import { ActionClientCtx } from "@/lib/utils/action-client/types/context";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { sendVerificationEmail } from "@/modules/email";
import { z } from "zod";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
});

export const resendVerificationEmailAction = actionClient.schema(ZResendVerificationEmailAction).action(
  withAuditLogging(
    "verificationEmailSent",
    "user",
    async ({ ctx, parsedInput }: { ctx: ActionClientCtx; parsedInput: Record<string, any> }) => {
      await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

      const user = await getUserByEmail(parsedInput.email);
      if (!user) {
        throw new ResourceNotFoundError("user", parsedInput.email);
      }
      if (user.emailVerified) {
        return {
          success: true,
        };
      }
      ctx.auditLoggingCtx.userId = user.id;
      await sendVerificationEmail(user);
      return {
        success: true,
      };
    }
  )
);
