import { prisma } from "@formbricks/database";
import type { IdentityProvider, Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { Account } from "@formbricks/types/auth";
import { WEBAPP_URL } from "@/lib/constants";
import { createEmailToken, createSsoRelinkIntent, verifySsoRelinkIntent } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { sendVerificationEmail } from "@/modules/email";
import {
  LINKED_SSO_LOOKUP_SELECT,
  TSsoAccountLinkInput,
  TSsoLookupUser,
  syncSsoIdentityForUser,
} from "./account-linking";
import { OAUTH_ACCOUNT_NOT_LINKED_ERROR, SSO_RECOVERY_COMPLETION_PATH } from "./constants";
import { normalizeSsoProvider } from "./provider-normalization";

const getSsoRecoveryLogger = (
  event: "sso_recovery_started" | "sso_recovery_completed" | "sso_recovery_failed"
) =>
  logger.withContext({
    event,
    name: "formbricks",
  });

const queueSsoRecoveryAuditEvent = ({
  action,
  status,
  userId,
  email,
  provider,
  callbackUrl,
  failureReason,
  reclaimed,
  sessionsRevoked,
}: {
  action: "sso_recovery_started" | "sso_recovery_completed" | "sso_recovery_failed";
  status: "success" | "failure";
  userId: string;
  email: string;
  provider: string;
  callbackUrl?: string;
  failureReason?: string;
  reclaimed?: TReclaimOutcome;
  /** `null` means the sweep threw — deliberately not conflated with "there were none". */
  sessionsRevoked?: number | null;
}) => {
  queueAuditEventBackground({
    action,
    targetType: "user",
    userId,
    targetId: userId,
    organizationId: UNKNOWN_DATA,
    status,
    userType: "user",
    newObject: {
      email,
      provider,
      ...(callbackUrl ? { callbackUrl } : {}),
      ...(failureReason ? { failureReason } : {}),
      // The one moment an account can change hands, so record what was taken away rather than only that
      // recovery succeeded. Marker keys in `newObject` are the house idiom (`passwordResetMarker`,
      // `twoFactorAuth: "disabled"`); `redactPII` matches exact lowercased keys, so these survive while
      // `email` above is redacted.
      ...(reclaimed
        ? {
            credentialPasswordsCleared: reclaimed.credentialPasswordsCleared,
            twoFactorRowsRemoved: reclaimed.twoFactorRowsRemoved,
            oauthGrantsRevoked: reclaimed.oauthGrantsRevoked,
            // `sessionsRevoked: 0` and "the sweep failed" are the same number but opposite incidents,
            // and this is the field a responder reads to confirm the squatter was actually kicked out.
            ...(sessionsRevoked === null ? { sessionRevocationFailed: true } : { sessionsRevoked }),
          }
        : {}),
    },
  });
};

/**
 * What `reclaimUnverifiedLocalAuthIfNeeded` actually removed, for the audit record. `null` means the
 * account was already proven and nothing was touched.
 */
type TReclaimOutcome = {
  credentialPasswordsCleared: number;
  twoFactorRowsRemoved: number;
  oauthGrantsRevoked: number;
} | null;

/**
 * Strip the local auth factors of an account whose email was never proven, at the moment an SSO identity
 * proves it (ENG-554, ENG-2557).
 *
 * The threat: an attacker registers on a victim's address, sets a password, and is held out only by
 * `requireEmailVerification`. Recovery then sets `emailVerified: true` — removing the very thing keeping
 * them out — so the untrusted factors have to go with it. The proof authorising this is NOT the IdP's
 * assertion: `startSsoRecovery` mails the address on record and completion requires the session that link
 * mints, plus `sessionUserId === intent.userId`. Upstream Better Auth does the same thing in
 * `revoke-unproven-account-access.mjs` for magic-link and email-OTP.
 *
 * THE FACTORS LIVE IN TWO PLACES EACH, and this is where ENG-2557 came from: the original control (#7755)
 * predates ENG-1054, which moved the password to `Account.password` and 2FA into the `TwoFactor` table.
 * It kept nulling the legacy `User` columns only, so post-cutover it stripped nothing at all — for any
 * user created after the cutover those columns are already null, because `signUpEmail` never writes them.
 * A mitigation that reads as present and does nothing is worse than none; write BOTH stores.
 *
 * The legacy `User` nulls are therefore kept deliberately, not left as dead code:
 * `better-auth-two-factor-backfill.ts` re-materialises a `TwoFactor` row from
 * `twoFactorEnabled && twoFactorSecret` on every successful credential sign-in, so dropping them would let
 * a later sign-in re-arm the attacker's factor. Both halves together disarm it twice.
 *
 * Two deliberate shapes worth not "simplifying":
 *
 * - The password is NULLED, not the row deleted. Sign-in behaviour is identical either way
 *   (`!currentPassword` → the same 401 after the same dummy hash), but the surviving row is what marks
 *   this user as a credential user, which is what lets `forgotPasswordAction` still offer them a reset —
 *   recovery flips `identityProvider` to the SSO provider and nothing ever flips it back, so deleting the
 *   row would lock them out of every password route with no self-service way back.
 * - The `where` is scoped by `userId`, NOT by `providerAccountId` / `issuer`, even though Better Auth's own
 *   `findCredentialAccount` filters on all four. Those are account-KEY columns and a drifted key is a real
 *   failure mode here (ENG-2555 was exactly that): a row whose key drifted still holds a live hash, and a
 *   query filtering on the key would walk straight past it. Owner-scoping cannot reach another user's row
 *   and does not go blind.
 *
 * The 2FA half is the weaker of the two, and worth stating honestly: Better Auth gates its challenge on
 * `user.twoFactorEnabled`, which the legacy update already clears, so the orphaned `TwoFactor` row was
 * never reachable at sign-in. Removing it is about not leaving a stale TOTP secret and backup codes at rest
 * on an account that has changed hands — not a live bypass.
 *
 * Sessions are revoked by the caller, after commit — Better Auth resolves its adapter from its own
 * AsyncLocalStorage, so a revocation issued in here would execute outside `tx` and survive a rollback.
 *
 * Not locked against concurrent recoveries (upstream takes a DB advisory lock for its equivalent). Every
 * write here is idempotent — two `deleteMany`/`updateMany` calls and an update to fixed values — so a race
 * converges on the same state rather than corrupting it.
 */
const reclaimUnverifiedLocalAuthIfNeeded = async ({
  tx,
  user,
}: {
  tx: Prisma.TransactionClient;
  user: TSsoLookupUser;
}): Promise<TReclaimOutcome> => {
  // Keyed on `emailVerified` alone. The old guard also required `identityProvider === "email"`, but that
  // column is denormalized onto `User` by an `account.create.after` hook — resting a security control on a
  // denormalized value means drift silently disables it.
  //
  // Worth being honest about the limit of this test: `emailVerified` is a one-bit latch, and it says the
  // address was proven, NOT that the account's local factors were ever proven by their owner. Anyone who
  // knows the account's password can have Better Auth re-send a verification mail (`sendOnSignIn`), so a
  // single victim click flips this and the strip below stops firing. That is the pre-hijacking vector in
  // ENG-2562, tracked separately, and closing it means invalidating the credential at verification time
  // too — not a different guard here.
  if (user.emailVerified) {
    return null;
  }

  // Sequential, not `Promise.all`: an interactive transaction is bound to a single connection, so
  // parallel writes on `tx` buy nothing here and only risk interleaving.
  //
  // The legacy columns: the 2FA pair is load-bearing (see the backfill note above); `password` is a no-op
  // for post-cutover users and kept only so a pre-cutover row cannot survive here.
  await tx.user.update({
    where: { id: user.id },
    data: {
      backupCodes: null,
      emailVerified: true,
      password: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  });
  const twoFactorRows = await tx.twoFactor.deleteMany({ where: { userId: user.id } });
  const credentialRows = await tx.account.updateMany({
    where: { userId: user.id, provider: "credential" },
    data: { password: null },
  });

  // MCP OAuth grants the account minted while its address was unproven. Without this the sweep is
  // incomplete in the one direction that outlives it: `oauthProvider` is registered unconditionally
  // (auth.ts) with open dynamic client registration, so a holder of a live session can bank a refresh
  // token good for 30 days — far longer than the session revoked below, and unreachable by it because
  // both token tables' `session` FK is `onDelete: SetNull`, which blanks the liveness check rather than
  // failing it. `revoked` is the field both introspection paths actually honour.
  const revokedAt = new Date();
  const [accessRows, refreshRows] = [
    await tx.oauthAccessToken.updateMany({
      where: { userId: user.id, revoked: null },
      data: { revoked: revokedAt },
    }),
    await tx.oauthRefreshToken.updateMany({
      where: { userId: user.id, revoked: null },
      data: { revoked: revokedAt },
    }),
  ];

  return {
    credentialPasswordsCleared: credentialRows.count,
    twoFactorRowsRemoved: twoFactorRows.count,
    oauthGrantsRevoked: accessRows.count + refreshRows.count,
  };
};

const createSsoRecoveryCompletionUrl = (intentToken: string): string => {
  const completionUrl = new URL(SSO_RECOVERY_COMPLETION_PATH, WEBAPP_URL);
  completionUrl.searchParams.set("intent", intentToken);

  return completionUrl.toString();
};

export const getSsoRecoveryFailureRedirectUrl = (callbackUrl?: string): string => {
  const loginUrl = new URL("/auth/login", WEBAPP_URL);
  loginUrl.searchParams.set("error", OAUTH_ACCOUNT_NOT_LINKED_ERROR);

  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (validatedCallbackUrl) {
    loginUrl.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  return loginUrl.toString();
};

export const startSsoRecovery = async ({
  existingUser,
  provider,
  account,
  callbackUrl,
}: {
  existingUser: TSsoLookupUser;
  provider: IdentityProvider;
  account: Account;
  callbackUrl: string;
}): Promise<string> => {
  const originalCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL) ?? WEBAPP_URL;

  try {
    const recoveryIntent = createSsoRelinkIntent({
      userId: existingUser.id,
      email: existingUser.email,
      provider,
      providerAccountId: account.providerAccountId,
      callbackUrl: originalCallbackUrl,
    });
    const completionUrl = createSsoRecoveryCompletionUrl(recoveryIntent);

    await sendVerificationEmail({
      id: existingUser.id,
      email: existingUser.email,
      locale: existingUser.locale,
      callbackUrl: completionUrl,
      purpose: "sso_recovery",
    });

    getSsoRecoveryLogger("sso_recovery_started").info(
      {
        userId: existingUser.id,
        provider,
        callbackUrl: originalCallbackUrl,
      },
      "SSO recovery started"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_started",
      status: "success",
      userId: existingUser.id,
      email: existingUser.email,
      provider,
      callbackUrl: originalCallbackUrl,
    });

    return buildVerificationRequestedPath({
      token: createEmailToken(existingUser.email),
      callbackUrl: completionUrl,
      purpose: "sso_recovery",
    });
  } catch (error) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        error,
        userId: existingUser.id,
        provider,
        callbackUrl: originalCallbackUrl,
      },
      "Failed to start SSO recovery"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: existingUser.id,
      email: existingUser.email,
      provider,
      callbackUrl: originalCallbackUrl,
      failureReason: error instanceof Error ? error.message : "unknown_error",
    });
    throw error;
  }
};

export const completeSsoRecovery = async ({
  intentToken,
  sessionUserId,
  sessionToken,
}: {
  intentToken: string;
  sessionUserId?: string;
  /**
   * The recovering user's own session token, so the post-commit revocation can spare it. Everything else
   * the account accrued while its address was unproven is swept.
   */
  sessionToken?: string;
}): Promise<string> => {
  let intent: ReturnType<typeof verifySsoRelinkIntent>;

  try {
    intent = verifySsoRelinkIntent(intentToken);
  } catch (error) {
    getSsoRecoveryLogger("sso_recovery_failed").error({ error }, "Invalid or expired SSO recovery intent");
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: UNKNOWN_DATA,
      email: UNKNOWN_DATA,
      provider: "unknown",
      failureReason: "invalid_or_expired_intent",
    });
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  const provider = normalizeSsoProvider(intent.provider);

  if (!provider) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        provider: intent.provider,
      },
      "SSO recovery failed due to an invalid provider"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: intent.userId,
      email: intent.email,
      provider: intent.provider,
      callbackUrl: intent.callbackUrl,
      failureReason: "invalid_provider",
    });
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  if (!sessionUserId) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        userId: intent.userId,
        provider,
      },
      "SSO recovery failed because there is no signed-in session"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: intent.userId,
      email: intent.email,
      provider,
      callbackUrl: intent.callbackUrl,
      failureReason: "missing_session",
    });
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  if (sessionUserId !== intent.userId) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        userId: intent.userId,
        provider,
        sessionUserId,
      },
      "SSO recovery failed because the signed-in user does not match the recovery intent"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: intent.userId,
      email: intent.email,
      provider,
      callbackUrl: intent.callbackUrl,
      failureReason: "session_user_mismatch",
    });
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: intent.userId,
    },
    select: LINKED_SSO_LOOKUP_SELECT,
  });

  if (user?.email !== intent.email) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        userId: intent.userId,
        provider: intent.provider,
      },
      "SSO recovery failed due to user mismatch"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: intent.userId,
      email: intent.email,
      provider: intent.provider,
      callbackUrl: intent.callbackUrl,
      failureReason: "user_mismatch",
    });
    throw new Error(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
  }

  const reclaimed = await prisma.$transaction(async (tx) => {
    const outcome = await reclaimUnverifiedLocalAuthIfNeeded({
      tx,
      user,
    });

    const recoveryAccount: TSsoAccountLinkInput = {
      type: "oauth",
      provider,
      providerAccountId: intent.providerAccountId,
    };

    await syncSsoIdentityForUser({
      userId: user.id,
      provider,
      account: recoveryAccount,
      tx,
    });

    return outcome;
  });

  // Only when factors were actually stripped: this is the account changing hands, so any session the
  // squatter still holds has to go. Reachable in practice because `signUpEmail` writes
  // `emailVerified: false` regardless of `requireEmailVerification`, so on an instance with
  // EMAIL_VERIFICATION_DISABLED=1 (the shipped .env.example and docker-compose default) an unproven
  // account can sign in and hold a live session for up to SESSION_MAX_AGE.
  //
  // After commit, never inside the transaction: Better Auth resolves its adapter from its own
  // AsyncLocalStorage, so this would run outside `tx` and outlive a rollback. Best-effort for the same
  // reason the strip must not be undone by a revocation failure — it has already committed.
  let sessionsRevoked: number | null = 0;
  if (reclaimed) {
    try {
      sessionsRevoked = await revokeUserSessionsExcept({
        userId: user.id,
        keepSessionToken: sessionToken,
      });
    } catch (error) {
      sessionsRevoked = null;
      logger.error(
        { error, userId: user.id },
        "Failed to revoke sessions after reclaiming unverified local auth"
      );
    }
  }

  try {
    await finalizeSuccessfulSignIn({
      userId: user.id,
      email: user.email,
      provider,
    });
  } catch (error) {
    logger.error(error, "Failed to finalize sign-in after SSO recovery");
  }

  getSsoRecoveryLogger("sso_recovery_completed").info(
    {
      userId: user.id,
      provider,
      callbackUrl: intent.callbackUrl,
    },
    "SSO recovery completed"
  );
  queueSsoRecoveryAuditEvent({
    action: "sso_recovery_completed",
    status: "success",
    userId: user.id,
    email: user.email,
    provider,
    callbackUrl: intent.callbackUrl,
    reclaimed,
    sessionsRevoked,
  });

  return getValidatedCallbackUrl(intent.callbackUrl, WEBAPP_URL) ?? WEBAPP_URL;
};
