import "server-only";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { loggableError } from "@/lib/utils/loggable-error";
import { auth } from "@/modules/auth/lib/auth";
import type { TVerificationRequestPurpose } from "@/modules/auth/lib/verification-links";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  type TSsoRecoveryIntent,
  getSsoRecoveryPairedTtlSeconds,
  refreshSsoRecoveryIntent,
} from "@/modules/ee/sso/lib/recovery-intent";
import { sendVerificationEmail } from "@/modules/email";

type TSsoRecoveryResend = { stateId: string; intent: TSsoRecoveryIntent };

type TDeliverVerificationEmailInput = {
  user: { id: string; email: string; locale: Parameters<typeof sendVerificationEmail>[0]["locale"] };
  callbackUrl?: string;
  /** Set when the resend finishes an SSO recovery rather than verifying an ordinary sign-up. */
  ssoRecoveryResend: TSsoRecoveryResend | null;
  /** A copy of the request's headers: Better Auth reads them, and the request has ended. */
  requestHeaders: Headers;
};

/**
 * Charge one mail against this account's resend budget. `false` when it is spent — and while Redis is
 * unavailable, since this limit fails closed (docs/adr/0016-abuse-limits-fail-closed.md).
 *
 * Anyone can ask for an account's email from the unauthenticated resend action, so this is counted per
 * account, only when a mail is about to go out, and below the recipient cap: strangers rotating IPs
 * cannot spend the whole cap and leave the user's own sign-in with none.
 */
const consumeAccountMailBudget = async (userId: string): Promise<boolean> => {
  try {
    await applyRateLimit(rateLimitConfigs.auth.verifyEmailPerAccount, userId);
    return true;
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return false;
    }
    throw error;
  }
};

const sendSsoRecoveryEmail = async ({
  user,
  callbackUrl,
  ssoRecoveryResend,
}: {
  user: TDeliverVerificationEmailInput["user"];
  callbackUrl?: string;
  ssoRecoveryResend: TSsoRecoveryResend;
}): Promise<void> => {
  // ENG-2783: the resent link and the refreshed intent get ONE lifetime, computed once here.
  //
  // Both halves are needed to finish recovery, so whichever expires first ends the flow — and if the
  // link is the survivor the user is signed in and then told recovery failed. A resend is where they
  // can come apart: the intent's refresh is capped against its original `createdAt` (the caller is
  // unauthenticated, so the window must not slide forever), while a freshly minted link would otherwise
  // take the full TTL no matter how close that ceiling is. Deriving the number twice would also let a
  // clock tick between the two, so it is derived once and passed to both.
  const pairedTtlSeconds = getSsoRecoveryPairedTtlSeconds(ssoRecoveryResend.intent);
  const purpose: TVerificationRequestPurpose = "sso_recovery";

  // SSO recovery keeps the app-minted JWT and the recovery magic link (routed to Better Auth's
  // /sso-recovery/sign-in endpoint via buildVerificationLinks).
  await sendVerificationEmail({
    id: user.id,
    email: user.email,
    locale: user.locale,
    callbackUrl,
    purpose,
    linkTtlSeconds: pairedTtlSeconds,
    // The same recovery the first link was bound to (ENG-7310).
    ssoRecoveryStateId: ssoRecoveryResend.stateId,
  });

  // Best-effort: the mail has gone out, so a failure here costs the pairing, not the resend.
  await refreshSsoRecoveryIntent(ssoRecoveryResend.stateId, pairedTtlSeconds);
};

/**
 * Everything a resend does that depends on the account, once the action has answered (ENG-7092).
 *
 * Runs in `after()`, so the per-account budget, the SMTP round trip and a refusal cannot change what the
 * caller sees or how long they wait. Without that, an unknown address, a verified account, a spent budget
 * and an unverified account each answered differently or at a different speed.
 *
 * Never throws: nothing after the response would catch it, so every failure is logged instead.
 */
export const deliverVerificationEmail = async ({
  user,
  callbackUrl,
  ssoRecoveryResend,
  requestHeaders,
}: TDeliverVerificationEmailInput): Promise<void> => {
  try {
    if (!(await consumeAccountMailBudget(user.id))) {
      logger.warn({ userId: user.id }, "Verification email skipped: per-account limit reached");
      return;
    }

    if (ssoRecoveryResend) {
      await sendSsoRecoveryEmail({ user, callbackUrl, ssoRecoveryResend });
      return;
    }

    // Email verification is Better Auth-native (ENG-1054 decommission): BA mints its own verification
    // token and sends the verify link through the emailVerification.sendVerificationEmail callback in
    // auth.ts. The user is unverified here, so BA takes its no-session, enumeration-safe path.
    await auth.api.sendVerificationEmail({
      body: { email: user.email, callbackURL: callbackUrl },
      headers: requestHeaders,
    });
  } catch (error) {
    logger.error({ ...loggableError(error), userId: user.id }, "Failed to deliver the verification email");
  }
};
