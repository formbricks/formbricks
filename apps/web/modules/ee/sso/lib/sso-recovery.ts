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
import { sendSsoRecoveryFactorsRemovedEmail, sendVerificationEmail } from "@/modules/email";
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
            legacyPasswordCleared: reclaimed.legacyPasswordCleared,
            twoFactorRowsRemoved: reclaimed.twoFactorRowsRemoved,
            legacyTwoFactorDisarmed: reclaimed.legacyTwoFactorDisarmed,
            // Reported separately, not summed. In this configuration access tokens are self-contained
            // JWTs that are never persisted (see the revocation block below), so the access count is
            // ~always 0 and a combined "grants" total would be the refresh count wearing a plural name —
            // unreadable for the one audience these fields exist for. Keeping both means an
            // access-token row appearing at all is itself visible, which would mean the opaque-token
            // configuration is in play.
            oauthAccessTokensRevoked: reclaimed.oauthAccessTokensRevoked,
            oauthRefreshTokensRevoked: reclaimed.oauthRefreshTokensRevoked,
            oauthConsentsRevoked: reclaimed.oauthConsentsRevoked,
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
  /** The pre-cutover `User.password` hash, which lives in a different store to the credential account. */
  legacyPasswordCleared: boolean;
  twoFactorRowsRemoved: number;
  /**
   * Whether THIS transaction flipped the legacy `User.twoFactorEnabled` latch. 2FA lives in two stores and the
   * strip clears both, but a user who enrolled before the backfill shim landed has only the legacy
   * columns — no `TwoFactor` row for `twoFactorRowsRemoved` to count. Reporting the row count alone
   * would tell that user, and the audit trail, that their second factor was left alone.
   */
  legacyTwoFactorDisarmed: boolean;
  oauthAccessTokensRevoked: number;
  oauthRefreshTokensRevoked: number;
  oauthConsentsRevoked: number;
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
  //
  // The INVERSE case matters just as much and is not hypothetical: `requireEmailVerification` is
  // `!EMAIL_VERIFICATION_DISABLED` (auth.ts) and `EMAIL_VERIFICATION_DISABLED=1` ships as the default in
  // `.env.example` and `docker/docker-compose.yml`. The verification mail still goes out but blocks
  // nothing, so on a default self-hosted install a user has no reason to click it and `emailVerified`
  // stays false for the life of the account. This guard's population there is not squatters — it is
  // every credential user who never bothered.
  //
  // For them a first-time SSO sign-in runs recovery and permanently removes their second factor: the
  // `TwoFactor` row goes, and the legacy `twoFactorEnabled`/`twoFactorSecret` nulls below (kept
  // deliberately, so the backfill shim cannot re-arm an attacker's factor) are exactly what stop it
  // being re-armed for a legitimate owner either. They can recover the password via
  // `forgotPasswordAction`, and then hold a one-factor account where two were enrolled, without being
  // told. Correct for a squatter, a silent downgrade for the owner.
  //
  // Left as-is on purpose: there is no signal here that separates the two populations, and weakening the
  // guard would reopen the takeover. What was missing was telling the user, and the completion path now
  // does — `sendSsoRecoveryFactorsRemovedEmail` names what was removed and links to re-enrolment
  // (ENG-2633). The in-app re-enrolment prompt is still open on that ticket.
  if (user.emailVerified) {
    return null;
  }

  // Sequential, not `Promise.all`: an interactive transaction is bound to a single connection, so
  // parallel writes on `tx` buy nothing here and only risk interleaving.
  //
  // The legacy columns: the 2FA pair is load-bearing (see the backfill note above); `password` is a no-op
  // for post-cutover users and kept only so a pre-cutover row cannot survive here.
  // The latch is flipped by its own filtered write so the count reflects what THIS transaction
  // changed. `user` was read before the transaction opened, and recoveries are deliberately not
  // locked against each other, so deriving the flag from that stale read lets two concurrent
  // recoveries both report they disarmed a factor only one of them touched — a duplicate mail and a
  // false audit record. The unconditional nulls below still run for everyone: a secret left at rest
  // on an account that changed hands is the thing the strip exists to prevent, and filtering those
  // on the latch would skip an account whose `twoFactorEnabled` was already false.
  const legacyTwoFactorRows = await tx.user.updateMany({
    where: { id: user.id, twoFactorEnabled: true },
    data: { twoFactorEnabled: false },
  });
  await tx.user.update({
    where: { id: user.id },
    data: {
      backupCodes: null,
      emailVerified: true,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  });
  // The legacy `User.password`, cleared as its own counted write rather than a field on the update
  // above. Pre-cutover accounts keep their hash here and may have no credential `Account` row at all,
  // so counting only those rows would tell such a user — and the audit trail — that nothing was taken
  // from them. `password: { not: null }` makes the count rows CHANGED, and reading it this way keeps
  // the hash itself out of the lookup select and out of memory.
  const legacyPasswordRows = await tx.user.updateMany({
    where: { id: user.id, password: { not: null } },
    data: { password: null },
  });
  const twoFactorRows = await tx.twoFactor.deleteMany({ where: { userId: user.id } });
  const credentialRows = await tx.account.updateMany({
    // `password: { not: null }` narrows this to rows that actually HELD a credential. `updateMany`
    // reports rows matched, not rows changed, so without it an account whose password was already null
    // reports one cleared — which the audit trail records as a factor taken away, and the notification
    // mail tells the user they lost a password they never had.
    where: { userId: user.id, provider: "credential", password: { not: null } },
    data: { password: null },
  });

  // MCP OAuth grants the account minted while its address was unproven. Without this the sweep is
  // incomplete in the one direction that outlives it: `oauthProvider` is registered unconditionally
  // (auth.ts) with open dynamic client registration, so a holder of a live session can bank a refresh
  // token good for 30 days — far longer than the session revoked below, and unreachable by it because
  // both token tables' `session` FK is `onDelete: SetNull`, which blanks the liveness check rather than
  // failing it.
  //
  // The REFRESH token is the one that matters and the one this actually stops: `handleRefreshTokenGrant`
  // reads `revoked`, so revoking it ends the 30-day persistence.
  //
  // ACCESS tokens are a different story, and worth stating plainly rather than implying this covers them.
  // Our config sets `resources` and never sets `disableJwtPlugin`, so `isJwtAccessToken` is always true
  // and every access token is a self-contained JWT: `createJwtAccessToken` signs without persisting, so
  // there is normally no row here to update, and `/api/mcp` verifies bearers against JWKS
  // (`modules/mcp/auth.ts`) without reading this table at all. Upstream's own revoke endpoint says as
  // much — "JWT access tokens are self-contained and cannot be revoked server-side". The write below is
  // therefore defence for the opaque-token configuration only; the residual is that a squatter's JWT
  // stays valid for up to `accessTokenExpiresIn` (15 min) after recovery. Shortening that, or checking
  // revocation at the resource server, is the only thing that would close it.
  //
  // Consent goes too: `/authorize` skips the consent screen when a matching `oauthConsent` row exists,
  // so leaving it would let a still-cookie-cached session (see session-revocation.ts) silently mint a
  // fresh 30-day refresh token and undo the revocation above.
  const revokedAt = new Date();
  const accessRows = await tx.oauthAccessToken.updateMany({
    where: { userId: user.id, revoked: null },
    data: { revoked: revokedAt },
  });
  const refreshRows = await tx.oauthRefreshToken.updateMany({
    where: { userId: user.id, revoked: null },
    data: { revoked: revokedAt },
  });
  const consentRows = await tx.oauthConsent.deleteMany({ where: { userId: user.id } });

  return {
    credentialPasswordsCleared: credentialRows.count,
    legacyPasswordCleared: legacyPasswordRows.count > 0,
    twoFactorRowsRemoved: twoFactorRows.count,
    legacyTwoFactorDisarmed: legacyTwoFactorRows.count > 0,
    oauthAccessTokensRevoked: accessRows.count,
    oauthRefreshTokensRevoked: refreshRows.count,
    oauthConsentsRevoked: consentRows.count,
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

  // Tell the account holder what recovery removed (ENG-2633). The strip is correct for a squatter and a
  // silent security downgrade for the owner — and on a default self-hosted install, where verification
  // blocks nothing, the owner is the likelier of the two. Nothing here can distinguish them, so the
  // answer is to say what happened rather than to weaken the guard.
  //
  // After commit and best-effort, for the same reason the session revocation above is: the strip has
  // already landed, and a mailer failure must not turn a completed recovery into a failed sign-in.
  const twoFactorRemoved = Boolean(
    reclaimed && (reclaimed.twoFactorRowsRemoved > 0 || reclaimed.legacyTwoFactorDisarmed)
  );
  const passwordRemoved = Boolean(
    reclaimed && (reclaimed.credentialPasswordsCleared > 0 || reclaimed.legacyPasswordCleared)
  );
  if (passwordRemoved || twoFactorRemoved) {
    try {
      const sent = await sendSsoRecoveryFactorsRemovedEmail({
        email: user.email,
        locale: user.locale,
        passwordRemoved,
        twoFactorRemoved,
      });
      // `sendEmail` returns false without throwing when SMTP is unconfigured, so the catch below never
      // sees it. Silence there would mean a user's second factor was removed and nobody — not them, not
      // the operator — was told, which is the whole failure this notification exists to prevent.
      if (!sent) {
        logger.error(
          { userId: user.id, passwordRemoved, twoFactorRemoved },
          "SSO recovery removed local sign-in factors but the notification email was not sent"
        );
      }
    } catch (error) {
      logger.error(
        { error, userId: user.id },
        "Failed to notify the user that SSO recovery removed their local sign-in factors"
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
