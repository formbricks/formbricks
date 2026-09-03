"use server";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { auth } from "@/modules/auth/lib/auth";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  classifySignupIntent,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { TVerificationRequestPurpose } from "@/modules/auth/lib/verification-links";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { SSO_RECOVERY_COMPLETION_PATH } from "@/modules/ee/sso/lib/constants";
import {
  type TSsoRecoveryIntent,
  readSsoRecoveryIntent,
  refreshSsoRecoveryIntent,
} from "@/modules/ee/sso/lib/recovery-intent";
import { sendVerificationEmail } from "@/modules/email";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
  callbackUrl: z.string().max(2000).optional(),
});

/**
 * The SSO-recovery intent this resend is for, or null when it is an ordinary verification resend.
 *
 * The email check is not decoration: this action is unauthenticated, so a state id must only unlock a
 * resend for the address it was minted for. That binding used to come free with the intent JWT's
 * signature; it is now an explicit comparison against the stored record (ENG-2783).
 *
 * The read deliberately does not consume the intent — the resent link points at the very same record.
 */
const resolveSsoRecoveryResend = async ({
  callbackUrl,
  userEmail,
}: {
  callbackUrl?: string;
  userEmail: string;
}): Promise<{ stateId: string; intent: TSsoRecoveryIntent } | null> => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (!validatedCallbackUrl) {
    return null;
  }

  const parsedCallbackUrl = new URL(validatedCallbackUrl);
  if (parsedCallbackUrl.pathname !== SSO_RECOVERY_COMPLETION_PATH) {
    return null;
  }

  const stateId = parsedCallbackUrl.searchParams.get("state");
  if (!stateId) {
    return null;
  }

  const intent = await readSsoRecoveryIntent(stateId);
  if (intent?.email.toLowerCase() !== userEmail.toLowerCase()) {
    return null;
  }

  return { stateId, intent };
};

export const resendVerificationEmailAction = actionClient.inputSchema(ZResendVerificationEmailAction).action(
  withAuditLogging("verificationEmailSent", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

    const user = await getUserByEmail(parsedInput.email);
    if (!user) {
      throw new ResourceNotFoundError("user", parsedInput.email);
    }
    const validatedCallbackUrl = getValidatedCallbackUrl(parsedInput.callbackUrl, WEBAPP_URL) ?? undefined;
    const ssoRecoveryResend = await resolveSsoRecoveryResend({
      callbackUrl: validatedCallbackUrl,
      userEmail: user.email,
    });
    const purpose: TVerificationRequestPurpose = ssoRecoveryResend ? "sso_recovery" : "email_verification";
    if (user.emailVerified && !ssoRecoveryResend) {
      return {
        success: true,
      };
    }
    ctx.auditLoggingCtx.userId = user.id;
    if (ssoRecoveryResend) {
      // SSO recovery keeps the app-minted JWT and the recovery magic link (now routed to Better Auth's
      // /sso-recovery/sign-in endpoint via buildVerificationLinks).
      await sendVerificationEmail({
        id: user.id,
        email: user.email,
        locale: user.locale,
        callbackUrl: validatedCallbackUrl,
        purpose,
      });

      // ENG-2783: re-pair the intent with the link just minted. The resend mints a fresh one-day link
      // while the intent keeps the clock it started with, so without this the new link outlives the
      // record it depends on and the user is signed in only to be told recovery failed — the same
      // pairing bug the sign-up intent cookie's resend refresh exists to avoid. Bounded against the
      // intent's original createdAt inside the helper, so an unauthenticated caller cannot slide the
      // window forever. Best-effort: the mail has gone out, so a failure here costs the pairing only.
      await refreshSsoRecoveryIntent(ssoRecoveryResend.stateId, ssoRecoveryResend.intent);
    } else {
      // Email verification is Better Auth-native (ENG-1054 decommission): BA mints its own verification
      // token and sends the verify link through the emailVerification.sendVerificationEmail callback in
      // auth.ts. The user is unverified here (the guard above returned for verified users), so BA takes
      // its no-session, enumeration-safe path.
      await auth.api.sendVerificationEmail({
        body: { email: user.email, callbackURL: validatedCallbackUrl },
        headers: await headers(),
      });

      // ENG-2562: re-pair the sign-up intent cookie with the link just minted. The cookie's clock
      // starts at sign-up while every resent link gets a fresh hour, so without this a resend's link
      // outlives the cookie and the sign-up browser itself lands on the withheld path. Strictly a
      // refresh — the browser must already hold a valid cookie naming THIS user — so it extends
      // evidence the browser has, and never arms one that lacks it: an unauthenticated caller must not
      // be able to mint sign-up proof for an arbitrary account by asking for a resend. A browser whose
      // cookie has already expired therefore stays on the withheld path (documented residual).
      // Non-fatal, like the sign-up issuance: the email above has already gone out, so a failure here
      // must cost exactly the auto-sign-in UX, never the resend itself.
      try {
        const cookieStore = await cookies();
        if (classifySignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE_NAME)?.value, user.id) === "valid") {
          cookieStore.set(
            SIGNUP_INTENT_COOKIE_NAME,
            createSignupIntentToken(user.id),
            SIGNUP_INTENT_COOKIE_OPTIONS
          );
        }
      } catch (error) {
        logger.error({ error, userId: user.id }, "Failed to refresh the sign-up intent cookie on resend");
      }
    }
    return {
      success: true,
    };
  })
);
