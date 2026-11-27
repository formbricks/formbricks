import "server-only";
import { logger } from "@formbricks/logger";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { EMAIL_AUTH_ENABLED, WEBAPP_URL } from "@/lib/constants";
import { loggableError } from "@/lib/utils/loggable-error";
import { sendSsoSignInHint } from "@/modules/auth/forgot-password/lib/sso-sign-in-hint";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { TAuditRequestMetadata } from "@/modules/ee/audit-logs/types/request-metadata";
import { type TSsoLinkedUser, getOfferedSsoProviders } from "@/modules/ee/sso/lib/linked-sso-providers";
import type { TSsoIdentityProvider } from "@/modules/ee/sso/lib/provider-normalization";

type TForgotPasswordMail =
  | { kind: "resetLink" }
  /** The providers the mail names; empty when none of the user's is offered, which it says instead. */
  | { kind: "ssoSignInHint"; providers: TSsoIdentityProvider[] };

/**
 * Which mail a forgot-password request gets: a reset link, or a hint naming the SSO providers the user
 * signs in with (ENG-3262). It follows the sign-in rule (ENG-2590): an account linked to SSO signs in with
 * SSO while this instance offers one of its providers, and with a password when it offers none.
 *
 * - A password user (`identityProvider === "email"`) gets a reset link, on an SSO-only instance too
 *   (pre-existing, left alone).
 * - An SSO user whose provider is offered gets the hint, even with a password on the account: the
 *   password cannot sign them in, so a reset link would only set one they cannot use.
 * - An SSO user with no offered provider gets a reset link, including one who never had a password, so
 *   they can set one and sign in. Better Auth's `resetPassword` creates the credential row when none
 *   exists. On an SSO-only instance (`EMAIL_AUTH_ENABLED` off) a password could not sign them in either,
 *   so they get the hint, which then points at their administrator.
 *
 * This is not the enforcement boundary; the session gate on `/sign-in/email` is. Since ENG-3639 the native
 * `POST /api/auth/request-password-reset` is closed (`disabledPaths` in auth.ts), so this flow and the
 * authenticated profile action (password users only) are the only ways to request a reset.
 *
 * `null` when the lookup failed: we cannot say either way, so the caller sends nothing at all.
 */
const chooseForgotPasswordMail = async (user: TSsoLinkedUser): Promise<TForgotPasswordMail | null> => {
  if (user.identityProvider === "email") {
    return { kind: "resetLink" };
  }

  let providers: TSsoIdentityProvider[];
  try {
    providers = await getOfferedSsoProviders(user);
  } catch (error) {
    logger.error(
      { ...loggableError(error), userId: user.id },
      "SSO provider lookup failed during password reset"
    );
    return null;
  }

  return providers.length > 0 || !EMAIL_AUTH_ENABLED
    ? { kind: "ssoSignInHint", providers }
    : { kind: "resetLink" };
};

/**
 * Charge one mail against this account's forgot-password budget (ENG-3640). The IP limit in the action
 * does not stop someone rotating addresses from flooding one inbox; this does. `false` when the budget is
 * spent, and also while Redis is unavailable: this limit fails closed (docs/adr/0016-abuse-limits-fail-closed.md).
 */
const consumeAccountMailBudget = async (userId: string): Promise<boolean> => {
  try {
    await applyRateLimit(rateLimitConfigs.auth.forgotPasswordPerAccount, userId);
    return true;
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      return false;
    }
    throw error;
  }
};

/**
 * Everything a forgot-password request does that depends on the address (ENG-3639).
 *
 * It runs after the response (`after()` in the action), so nothing here — whether the address exists,
 * whether it has a password, the token write, the SMTP round trip, a spent budget — can change what the
 * caller sees or how long they wait. OWASP: "Ensure that responses return in a consistent amount of time
 * to prevent an attacker enumerating which accounts exist."
 *
 * Never throws: nothing after the response would catch it, so every failure is logged instead.
 */
export const processPasswordResetRequest = async ({
  email,
  requestHeaders,
  requestMetadata,
}: {
  email: string;
  /** A copy of the request's headers: Better Auth's hooks read them, and the request has ended. */
  requestHeaders: Headers;
  /** For the audit record, captured while the request was live. */
  requestMetadata: TAuditRequestMetadata;
}): Promise<void> => {
  try {
    const user = await getUserByEmail(email);
    // A deactivated user cannot sign in by any route, so neither mail would lead anywhere.
    if (!user?.isActive) {
      return;
    }

    const mail = await chooseForgotPasswordMail(user);
    if (mail === null) {
      return;
    }

    if (!(await consumeAccountMailBudget(user.id))) {
      logger.warn({ userId: user.id }, "Forgot-password mail skipped: per-account limit reached");
      return;
    }

    if (mail.kind === "ssoSignInHint") {
      // Their password cannot sign them in: tell them how they do sign in (ENG-3262, ENG-2590).
      await sendSsoSignInHint(user, mail.providers);
      return;
    }

    await auth.api.requestPasswordReset({
      body: { email: user.email, redirectTo: `${WEBAPP_URL}/auth/forgot-password/reset` },
      headers: requestHeaders,
    });

    // Recorded only once the request went through, so the trail never claims a reset that was not
    // requested. The actor stays unknown — this flow is unauthenticated by design — and the target is
    // the account the reset was requested for.
    await queueAuditEventWithoutRequest({
      action: "passwordReset",
      targetType: "user",
      userId: UNKNOWN_DATA,
      userType: "user",
      targetId: user.id,
      organizationId: UNKNOWN_DATA,
      status: "success",
      requestMetadata,
    });
  } catch (error) {
    // `err`, not `error`: pino serializes an Error's message and stack only under `err`.
    logger.error({ err: error }, "Forgot-password request failed after the response");
  }
};
