import "server-only";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { EMAIL_AUTH_ENABLED, WEBAPP_URL } from "@/lib/constants";
import { hasCredentialAccount } from "@/lib/user/password";
import { sendSsoSignInHint } from "@/modules/auth/forgot-password/lib/sso-sign-in-hint";
import { auth } from "@/modules/auth/lib/auth";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

/**
 * Whether this user has a password to reset. Pure SSO users do not: they get a mail naming their identity
 * provider instead (ENG-3262).
 *
 * The second arm exists because SSO recovery is one-way (ENG-2557): completing it flips
 * `identityProvider` to the SSO provider and nothing ever flips it back, while the recovery also clears
 * the password it found. Gated on `identityProvider` alone, those users could never ask for a reset again
 * — locked to an IdP they might lose access to, with `auth.api.setPassword` being `serverOnly` and
 * unwired. The surviving credential `Account` row identifies them: recovery nulls the password, it does
 * not delete the row.
 *
 * Kept as narrow as that problem, deliberately: gating on the credential row rather than on
 * `emailVerified` means this grants nothing to a user who has only ever signed in via SSO, and
 * `EMAIL_AUTH_ENABLED` switches the second arm off entirely on an SSO-only instance. Note that gate
 * covers only the second arm — an `identityProvider === "email"` user still receives reset mail on an
 * SSO-only instance, which is pre-existing behaviour left alone here. So the flag is about not *widening*
 * that surface, not about closing it.
 *
 * Neither is the enforcement boundary. Better Auth's `resetPassword` CREATES a credential row when none
 * exists, so whoever can request a reset can mint a password; what contains that is `/sign-in/email`,
 * which is gated on `EMAIL_AUTH_ENABLED`, so a minted password is unusable on an SSO-only instance. Since
 * ENG-3639 the native `POST /api/auth/request-password-reset` is closed (`disabledPaths` in auth.ts), so
 * this flow and the authenticated profile action are the only ways to request one.
 *
 * `null` when the lookup failed: we cannot say either way, so the caller sends nothing at all.
 */
export const canResetPassword = async (user: {
  id: string;
  identityProvider: IdentityProvider;
}): Promise<boolean | null> => {
  if (user.identityProvider === "email") {
    return true;
  }
  if (!EMAIL_AUTH_ENABLED) {
    return false;
  }

  try {
    return await hasCredentialAccount(user.id);
  } catch (error) {
    logger.error({ err: error, userId: user.id }, "Credential-account lookup failed during password reset");
    return null;
  }
};

/**
 * Everything a forgot-password request does that depends on the address (ENG-3639).
 *
 * It runs after the response (`after()` in the action), so nothing here — whether the address exists,
 * whether it has a password, the token write, the SMTP round trip — can change what the caller sees or
 * how long they wait. OWASP: "Ensure that responses return in a consistent amount of time
 * to prevent an attacker enumerating which accounts exist."
 *
 * Never throws: nothing after the response would catch it, so every failure is logged instead.
 */
export const processPasswordResetRequest = async ({
  email,
  requestHeaders,
  ipAddress,
}: {
  email: string;
  /** A copy of the request's headers: Better Auth's hooks read them, and the request has ended. */
  requestHeaders: Headers;
  /** For the audit record, captured while the request was live. */
  ipAddress: string;
}): Promise<void> => {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return;
    }

    const resettable = await canResetPassword(user);
    if (resettable === null) {
      return;
    }

    if (!resettable) {
      // No password to reset, e.g. Azure AD only: tell them how they do sign in (ENG-3262).
      await sendSsoSignInHint(user);
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
      ipAddress,
    });
  } catch (error) {
    // `err`, not `error`: pino serializes an Error's message and stack only under `err`.
    logger.error({ err: error }, "Forgot-password request failed after the response");
  }
};
