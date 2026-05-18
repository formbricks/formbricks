"use server";

import { z } from "zod";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { verifySsoRelinkIntent } from "@/lib/jwt";
import { actionClient } from "@/lib/utils/action-client";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { TVerificationRequestPurpose } from "@/modules/auth/lib/verification-links";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { SSO_RECOVERY_COMPLETION_PATH } from "@/modules/ee/sso/lib/constants";
import { sendVerificationEmail } from "@/modules/email";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
  callbackUrl: z.string().max(2000).optional(),
});

const getVerificationRequestPurpose = ({
  callbackUrl,
  userEmail,
}: {
  callbackUrl?: string;
  userEmail: string;
}): TVerificationRequestPurpose => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (!validatedCallbackUrl) {
    return "email_verification";
  }

  const parsedCallbackUrl = new URL(validatedCallbackUrl);
  if (parsedCallbackUrl.pathname !== SSO_RECOVERY_COMPLETION_PATH) {
    return "email_verification";
  }

  const intentToken = parsedCallbackUrl.searchParams.get("intent");
  if (!intentToken) {
    return "email_verification";
  }

  try {
    const intent = verifySsoRelinkIntent(intentToken);
    return intent.email.toLowerCase() === userEmail.toLowerCase() ? "sso_recovery" : "email_verification";
  } catch {
    return "email_verification";
  }
};

export const resendVerificationEmailAction = actionClient.inputSchema(ZResendVerificationEmailAction).action(
  withAuditLogging("verificationEmailSent", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new ResourceNotFoundError("user", parsedInput.email);
    }
    const validatedCallbackUrl = getValidatedCallbackUrl(parsedInput.callbackUrl, WEBAPP_URL) ?? undefined;
    const purpose = getVerificationRequestPurpose({
      callbackUrl: validatedCallbackUrl,
      userEmail: user.email,
    });
    if (user.emailVerified && purpose !== "sso_recovery") {
      return {
        success: true,
      };
    }
    ctx.auditLoggingCtx.userId = user.id;
    await sendVerificationEmail({
      id: user.id,
      email: user.email,
      locale: user.locale,
      callbackUrl: validatedCallbackUrl,
      purpose,
    });
    return {
      success: true,
    };
  })
);
