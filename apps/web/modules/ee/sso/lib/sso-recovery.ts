import { prisma } from "@formbricks/database";
import type { IdentityProvider, Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { Account } from "@formbricks/types/auth";
import {
  SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE,
  SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE,
} from "@formbricks/types/errors";
import { WEBAPP_URL } from "@/lib/constants";
import { createEmailToken, createSsoRelinkIntent, verifySsoRelinkIntent } from "@/lib/jwt";
import { loggableError } from "@/lib/utils/loggable-error";
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
import {
  OAUTH_ACCOUNT_NOT_LINKED_ERROR,
  SSO_RECOVERY_COMPLETION_PATH,
  SSO_RECOVERY_CONFIRM_PATH,
} from "./constants";
import { normalizeSsoProvider } from "./provider-normalization";
import { claimSsoRecovery, markSsoRecoverySpent } from "./recovery-claim";
import { getSsoRecoveryStateId, isValidSsoRecoveryProof } from "./recovery-proof";

type TSsoIdentityProvider = Exclude<IdentityProvider, "email">;

type TSsoRecoveryIntent = ReturnType<typeof verifySsoRelinkIntent>;

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
  twoFactorRowsRemoved: number;
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
  // guard would reopen the takeover. What is missing is telling the user — mail them what was removed and
  // prompt re-enrolment. That needs a new transactional template, so it is tracked separately rather than
  // widened into a fix that backports to two release branches.
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
    twoFactorRowsRemoved: twoFactorRows.count,
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

const buildSsoRecoveryLoginUrl = (callbackUrl: string | undefined, error?: string): string => {
  const loginUrl = new URL("/auth/login", WEBAPP_URL);
  if (error) {
    loginUrl.searchParams.set("error", error);
  }

  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (validatedCallbackUrl) {
    loginUrl.searchParams.set("callbackUrl", validatedCallbackUrl);
  }

  return loginUrl.toString();
};

export const getSsoRecoveryFailureRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl, OAUTH_ACCOUNT_NOT_LINKED_ERROR);

/**
 * Where the recovery link sends a user whose second factor it cannot check (ENG-7266): the login page,
 * carrying the completion URL as `callbackUrl`. They sign in with password + TOTP (or a linked SSO
 * provider), the login form follows the callback, and `completeSsoRecovery` links the new identity once
 * the session user matches the intent.
 */
export const getSsoRecoverySecondFactorRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl);

/**
 * The same redirect where the login page cannot produce the second factor: the instance has credential
 * sign-in switched off (`EMAIL_AUTH_DISABLED=1`), so the form that would ask for password + TOTP is not
 * rendered, and the identity that started recovery is unlinked by definition. A provider already linked
 * to the account still gets the user through, which is why the copy names that before the administrator;
 * landing there without a word is the silent loop this code exists to end (ENG-7266).
 */
export const getSsoRecoverySecondFactorUnavailableRedirectUrl = (callbackUrl?: string): string =>
  buildSsoRecoveryLoginUrl(callbackUrl, SSO_RECOVERY_SECOND_FACTOR_UNAVAILABLE_ERROR_CODE);

/**
 * `unproven` is a valid intent reached by a browser that never opened the emailed link (ENG-7310). It
 * says nothing against the caller's session: the session was not minted by the link, since opening the
 * link is what sets the proof. So, like `intent_unusable`, it skips the teardown. Tearing down here
 * would also let anyone holding a completion URL sign a victim out by sending them to it.
 */
export type TSsoRecoveryFailure = "intent_unusable" | "unproven" | "rejected";

/**
 * A refused recovery, sometimes carrying the callback the caller should bounce back to. `callbackUrl` is
 * set only once the caller has proven to be the intent's own user (the `user_mismatch` branch), so the
 * failure redirect never hands a stranger the place the account holder was headed.
 *
 * `intent_unusable` means there is nothing to act on: the intent did not verify (expired, malformed,
 * forged), it was already linked or cancelled, or another Link or Cancel holds it. `unproven` means this
 * browser never opened the emailed link. `rejected` means a later guard turned a usable intent down.
 */
export class SsoRecoveryError extends Error {
  readonly failure: TSsoRecoveryFailure;
  readonly callbackUrl?: string;

  constructor(failure: TSsoRecoveryFailure, callbackUrl?: string) {
    super(OAUTH_ACCOUNT_NOT_LINKED_ERROR);
    this.name = "SsoRecoveryError";
    this.failure = failure;
    this.callbackUrl = callbackUrl;
  }
}

/**
 * Where a completion goes when this browser never opened the emailed link (ENG-7310). Never carries a
 * callback: the caller has not proven anything, and the intent's callback would tell them where the
 * account holder was headed.
 */
export const getSsoRecoveryLinkNotOpenedRedirectUrl = (): string =>
  buildSsoRecoveryLoginUrl(undefined, SSO_RECOVERY_LINK_NOT_OPENED_ERROR_CODE);

/** Where a refused recovery sends the browser, and whether the completion route revokes its session. */
export type TSsoRecoveryRefusal = { redirectUrl: string; revokesSession: boolean };

/**
 * Every way a recovery can be refused, in one place, so the confirmation page and the completion route
 * cannot disagree about where a refusal goes or whether it costs the caller their session.
 *
 * `intent_unusable` and `unproven` leave the session alone. The emailed link can be opened again after a
 * link succeeded, and that must not sign the user out; and a browser that never opened the link holds a
 * session the link did not mint. Skipping the teardown is safe because it only revokes the caller's own
 * token, and the link itself already failed closed before any write.
 *
 * `rejected`, and any unexpected throw, keep the ENG-2557 teardown. Only the completion route can apply
 * it: the page is a server component and cannot clear cookies.
 */
const SSO_RECOVERY_REFUSALS: Record<
  TSsoRecoveryFailure | "unexpected",
  (callbackUrl?: string) => TSsoRecoveryRefusal
> = {
  intent_unusable: () => ({ redirectUrl: getSsoRecoveryFailureRedirectUrl(), revokesSession: false }),
  unproven: () => ({ redirectUrl: getSsoRecoveryLinkNotOpenedRedirectUrl(), revokesSession: false }),
  rejected: (callbackUrl) => ({
    redirectUrl: getSsoRecoveryFailureRedirectUrl(callbackUrl),
    revokesSession: true,
  }),
  unexpected: () => ({ redirectUrl: getSsoRecoveryFailureRedirectUrl(), revokesSession: true }),
};

export const getSsoRecoveryRefusal = (error: unknown): TSsoRecoveryRefusal =>
  error instanceof SsoRecoveryError
    ? SSO_RECOVERY_REFUSALS[error.failure](error.callbackUrl)
    : SSO_RECOVERY_REFUSALS.unexpected();

/** The confirmation page for a recovery (ENG-7395). */
export const getSsoRecoveryConfirmUrl = (intentToken: string): string => {
  const confirmUrl = new URL(SSO_RECOVERY_CONFIRM_PATH, WEBAPP_URL);
  confirmUrl.searchParams.set("intent", intentToken);

  return confirmUrl.toString();
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
      // Signed into the mailed token, so the link mints its proof only for this recovery (ENG-7310).
      ssoRecoveryStateId: getSsoRecoveryStateId(recoveryIntent),
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

/**
 * The after-commit half of a reclaim: sweep the squatter's sessions. Best-effort, because the strip has
 * committed. Returns how many sessions were revoked, or null when the sweep failed.
 */
const settleReclaimedCredentials = async ({
  reclaimed,
  user,
  sessionToken,
}: {
  reclaimed: Awaited<ReturnType<typeof reclaimUnverifiedLocalAuthIfNeeded>>;
  user: TSsoLookupUser;
  sessionToken: string | undefined;
}): Promise<number | null> => {
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
        { ...loggableError(error), userId: user.id },
        "Failed to revoke sessions after reclaiming unverified local auth"
      );
    }
  }

  return sessionsRevoked;
};

/** What a browser brings to act on a recovery: which one, and the proof and session it holds. */
export type TSsoRecoveryAccess = {
  intentToken: string;
  /** The proof cookie set when this browser opened the emailed link (`recovery-proof.ts`). */
  recoveryProof?: string;
  sessionUserId?: string;
};

/**
 * The account's address no longer matches the one recovery was started for. Logged, audited and refused,
 * from the guard and again from inside the linking transaction, so a change that lands in between leaves
 * the same trace.
 */
const rejectSsoRecoveryUserMismatch = (intent: TSsoRecoveryIntent): SsoRecoveryError => {
  getSsoRecoveryLogger("sso_recovery_failed").error(
    { userId: intent.userId, provider: intent.provider },
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
  // Past the session check, so this caller IS the intent's user — handing back their own callback
  // discloses nothing they did not already supply.
  return new SsoRecoveryError("rejected", intent.callbackUrl);
};

/** Every guard a Link, a Cancel and the confirmation page share. Writes nothing. */
const authorizeSsoRecovery = async ({ intentToken, recoveryProof, sessionUserId }: TSsoRecoveryAccess) => {
  let intent: TSsoRecoveryIntent;

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
    throw new SsoRecoveryError("intent_unusable");
  }

  const normalizedProvider = normalizeSsoProvider(intent.provider);
  // `normalizeSsoProvider` never answers "email"; the check narrows the type to an SSO provider.
  const provider = normalizedProvider === "email" ? null : normalizedProvider;

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
    throw new SsoRecoveryError("rejected");
  }

  const stateId = getSsoRecoveryStateId(intentToken);

  // Before any session check (ENG-7310). The completion URL also reaches the browser that STARTED
  // recovery, and that may be an attacker whose IdP identity claims this address. A session for the
  // intent's user proves nothing either: any page can navigate the user's own signed-in browser here.
  // Only the browser that opened the link mailed to the account carries this proof.
  if (!isValidSsoRecoveryProof(recoveryProof, intent.userId, stateId)) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {
        userId: intent.userId,
        provider,
      },
      "SSO recovery failed because this browser did not open the recovery link"
    );
    queueSsoRecoveryAuditEvent({
      action: "sso_recovery_failed",
      status: "failure",
      userId: intent.userId,
      email: intent.email,
      provider,
      callbackUrl: intent.callbackUrl,
      failureReason: "missing_recovery_proof",
    });
    throw new SsoRecoveryError("unproven");
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
    throw new SsoRecoveryError("rejected");
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
    throw new SsoRecoveryError("rejected");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: intent.userId,
    },
    select: LINKED_SSO_LOOKUP_SELECT,
  });

  if (user?.email !== intent.email) {
    throw rejectSsoRecoveryUserMismatch(intent);
  }

  return { intent, provider, user, stateId };
};

/**
 * What the confirmation page shows before the account holder chooses to link (ENG-7395): the provider
 * that would be linked and the account it changes. Runs every completion guard and writes nothing, so a
 * page view cannot link, strip or spend anything, and a browser the POST would refuse is refused here.
 */
export const getSsoRecoveryConfirmation = async (
  args: TSsoRecoveryAccess
): Promise<{ provider: TSsoIdentityProvider; email: string }> => {
  const { provider, user } = await authorizeSsoRecovery(args);
  return { provider, email: user.email };
};

const LOST_CLAIM_REASONS = {
  held: "claimed_by_another_request",
  spent: "intent_already_spent",
  unavailable: "claim_unavailable",
} as const;

/** Leaves a trace of a Link or Cancel that could not claim the recovery, and why (ENG-7395). */
const recordLostSsoRecoveryClaim = (
  intent: TSsoRecoveryIntent,
  provider: TSsoIdentityProvider,
  outcome: keyof typeof LOST_CLAIM_REASONS
) => {
  getSsoRecoveryLogger("sso_recovery_failed").info(
    { userId: intent.userId, provider, outcome },
    "SSO recovery could not be claimed"
  );
  queueSsoRecoveryAuditEvent({
    action: "sso_recovery_failed",
    status: "failure",
    userId: intent.userId,
    email: intent.email,
    provider,
    callbackUrl: intent.callbackUrl,
    failureReason: LOST_CLAIM_REASONS[outcome],
  });
};

/**
 * The account holder declined on the confirmation page (ENG-7395). Marks the recovery spent so the link
 * can no longer complete anything, from this browser or any other, and records why. Runs the same guards
 * as a completion, so only the browser that could have linked can cancel.
 */
export const cancelSsoRecovery = async (args: TSsoRecoveryAccess): Promise<void> => {
  const { intent, provider, stateId } = await authorizeSsoRecovery(args);

  // A Link in flight holds the claim, and a spent recovery cannot be claimed: either way this cancel did
  // not happen, so no cancellation is recorded.
  const claim = await claimSsoRecovery(stateId);
  if (claim.kind !== "claimed") {
    recordLostSsoRecoveryClaim(intent, provider, claim.kind);
    throw new SsoRecoveryError("intent_unusable");
  }

  try {
    // Unmarked, the link would stay usable until the intent expires; the user is told it is unusable.
    if (!(await markSsoRecoverySpent(stateId))) {
      throw new SsoRecoveryError("intent_unusable");
    }
  } finally {
    await claim.release();
  }

  getSsoRecoveryLogger("sso_recovery_failed").info(
    { userId: intent.userId, provider },
    "SSO recovery cancelled by the account holder"
  );
  queueSsoRecoveryAuditEvent({
    action: "sso_recovery_failed",
    status: "failure",
    userId: intent.userId,
    email: intent.email,
    provider,
    callbackUrl: intent.callbackUrl,
    failureReason: "cancelled_by_user",
  });
};

/**
 * Links the pending SSO identity. Reached only by the POST from the confirmation page (ENG-7395): a GET
 * can be issued by a mail scanner or by a page the account holder never meant to act on.
 */
export const completeSsoRecovery = async ({
  intentToken,
  recoveryProof,
  sessionUserId,
  sessionToken,
}: TSsoRecoveryAccess & {
  /**
   * The recovering user's own session token, so the post-commit revocation can spare it. Everything else
   * the account accrued while its address was unproven is swept.
   */
  sessionToken?: string;
}): Promise<string> => {
  const { intent, provider, user, stateId } = await authorizeSsoRecovery({
    intentToken,
    recoveryProof,
    sessionUserId,
  });

  // Only one request acts on a recovery: a Cancel holding the claim, or a recovery already linked or
  // cancelled, stops this link before it writes anything.
  const claim = await claimSsoRecovery(stateId);
  if (claim.kind !== "claimed") {
    recordLostSsoRecoveryClaim(intent, provider, claim.kind);
    throw new SsoRecoveryError("intent_unusable");
  }

  // Kept when the link committed but the recovery could not be marked spent: released, it would let a
  // later Cancel claim it and record a cancellation for an identity that is linked.
  let keepClaim = false;
  let reclaimed: Awaited<ReturnType<typeof reclaimUnverifiedLocalAuthIfNeeded>>;
  try {
    reclaimed = await prisma.$transaction(async (tx) => {
      // The address was checked against the intent before the claim; check it again here, holding the
      // user row, so an email change cannot commit between that check and the link. FOR UPDATE makes a
      // concurrent change wait for this transaction instead of slipping in after a plain read.
      //
      // `emailVerified` is re-read under the same lock because it decides the reclaim. Two recoveries
      // for one user hold different intents, so both can pass the guards; the second then waits here
      // while the first verifies the address. Deciding from the read taken before the lock, it would
      // strip again and sweep the sessions the first recovery kept.
      const [locked] = await tx.$queryRaw<{ email: string; emailVerified: boolean }[]>`
        SELECT "email", "email_verified" AS "emailVerified" FROM "User" WHERE "id" = ${user.id} FOR UPDATE
      `;
      if (locked?.email !== intent.email) {
        throw rejectSsoRecoveryUserMismatch(intent);
      }

      const outcome = await reclaimUnverifiedLocalAuthIfNeeded({
        tx,
        user: { ...user, emailVerified: locked.emailVerified },
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

    // Single use, applied once the link has committed: the emailed link cannot link or cancel again.
    // Best-effort inside the helper: the account is already linked, and a Redis hiccup here must not turn
    // a completed recovery into a failure.
    keepClaim = !(await markSsoRecoverySpent(stateId));
  } finally {
    // After a rollback this frees the recovery for a retry; after a link the recovery is already spent.
    if (!keepClaim) await claim.release();
  }

  const sessionsRevoked = await settleReclaimedCredentials({ reclaimed, user, sessionToken });

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
