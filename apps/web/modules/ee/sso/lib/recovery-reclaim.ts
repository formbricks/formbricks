import "server-only";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { reconcileApiKeyRelationships } from "@/lib/authzed/api-key";
import { runPostCommitProjection } from "@/lib/authzed/projection-boundary";
import { loggableError } from "@/lib/utils/loggable-error";
import { finishRevokedMcpGrants, revokeAllUserOAuthGrants } from "@/modules/auth/lib/mcp-grant-revocation";
import { revokeUserSessionsExcept } from "@/modules/auth/lib/session-revocation";
import { sendSsoRecoveryFactorsRemovedEmail } from "@/modules/email";
import type { TMcpGrantAuditRecord } from "@/modules/mcp/grant-audit";
import { TSsoLookupUser } from "./account-linking";

export type TReclaimOutcome = {
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
  /** Keys this user minted, deleted outright — `ApiKey` has no revoked state. */
  apiKeysRevoked: number;
  /** The same keys by id, for the post-commit SpiceDB cleanup. Not part of the audit record. */
  revokedApiKeyIds: string[];
  /** The MCP grants that ended, audited on their own once the transaction commits. */
  revokedMcpGrantAudits: TMcpGrantAuditRecord[];
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
 *   this user as a credential user, which is what lets the password-reset request
 *   (`POST /api/internal/password-reset-requests`) still offer them a reset —
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
 * API keys go too (ENG-2634), and they were the one credential that outlived recovery entirely: a key is
 * org-scoped with no expiry and no session behind it, so a squatter who held a session long enough to
 * create an organization and a key kept reading and writing through the API after password, 2FA,
 * sessions and OAuth grants had all died. Scoped to `createdBy: user.id`, NOT to every key on the
 * organizations the user reached — an organization can have been shared by then, and a colleague's key
 * is not the squatter's. `ApiKey` has no revoked state, so the rows are deleted the way `deleteApiKey`
 * does it; the `authzed_projection_api_key` trigger enqueues the SpiceDB cleanup and the caller
 * reconciles the ids post-commit as well.
 *
 * Sessions are revoked by the caller, after commit — Better Auth resolves its adapter from its own
 * AsyncLocalStorage, so a revocation issued in here would execute outside `tx` and survive a rollback.
 *
 * Not locked against concurrent recoveries (upstream takes a DB advisory lock for its equivalent). Every
 * write here is idempotent — the `deleteMany`/`updateMany` calls and an update to fixed values — so a race
 * converges on the same state rather than corrupting it.
 */
export const reclaimUnverifiedLocalAuthIfNeeded = async ({
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
  // the password-reset request, and then hold a one-factor account where two were enrolled, without being
  // told. Correct for a squatter, a silent downgrade for the owner.
  //
  // Left as-is on purpose: there is no signal here that separates the two populations, and weakening the
  // guard would reopen the takeover. What was missing was telling the user, and the completion path now
  // does — `sendSsoRecoveryFactorsRemovedEmail` names what was removed and links to re-enrolment
  // (ENG-2633).
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
  // token good for 30 days — far longer than the session revoked below. What revoking covers, MCP grants
  // and so the live JWT access tokens included (ENG-7149), is on `revokeAllUserOAuthGrants`.
  const oauth = await revokeAllUserOAuthGrants(tx, user.id);

  // The keys this user minted (ENG-2634). Ids first: `deleteMany` reports only a count, and the caller
  // needs the ids to drop the SpiceDB relationships after commit. Deleting inside the transaction means
  // a rolled-back link leaves the keys exactly as they were, like every other write here.
  const apiKeys = await tx.apiKey.findMany({ where: { createdBy: user.id }, select: { id: true } });
  const apiKeyRows = await tx.apiKey.deleteMany({ where: { createdBy: user.id } });

  return {
    credentialPasswordsCleared: credentialRows.count,
    legacyPasswordCleared: legacyPasswordRows.count > 0,
    twoFactorRowsRemoved: twoFactorRows.count,
    legacyTwoFactorDisarmed: legacyTwoFactorRows.count > 0,
    oauthAccessTokensRevoked: oauth.accessTokensRevoked,
    oauthRefreshTokensRevoked: oauth.refreshTokensRevoked,
    oauthConsentsRevoked: oauth.consentsDeleted,
    apiKeysRevoked: apiKeyRows.count,
    revokedApiKeyIds: apiKeys.map(({ id }) => id),
    revokedMcpGrantAudits: oauth.grantAudits,
  };
};

/**
 * After a committed reclaim: revoke the account's other sessions, and what the removed API keys and MCP
 * grants still need outside Postgres. Returns the sessions revoked, `null` when revoking them failed.
 */
export const settleReclaimedCredentials = async (
  reclaimed: NonNullable<TReclaimOutcome>,
  userId: string,
  keepSessionToken: string | undefined
): Promise<number | null> => {
  let sessionsRevoked: number | null;
  try {
    sessionsRevoked = await revokeUserSessionsExcept({ userId, keepSessionToken });
  } catch (error) {
    sessionsRevoked = null;
    logger.error(
      { ...loggableError(error), userId },
      "Failed to revoke sessions after reclaiming unverified local auth"
    );
  }
  // The keys are already gone from Postgres, which is what ends their access — the API auth path looks
  // a key up by hash and now finds nothing. SpiceDB keeps their relationships until the outbox worker
  // reaches the trigger-enqueued event; reconciling here is the same belt-and-braces `deleteApiKey`
  // does, and best-effort for the same reason the session sweep is.
  if (reclaimed.revokedApiKeyIds.length > 0) {
    await runPostCommitProjection("sso_recovery_api_key_cleanup", () =>
      reconcileApiKeyRelationships({ apiKeyIds: reclaimed.revokedApiKeyIds })
    );
  }
  // Each ended MCP grant loses its SpiceDB relationships, best-effort, and gets its own entry under the
  // organizations it reached, as any revoke does.
  await finishRevokedMcpGrants(reclaimed.revokedMcpGrantAudits);
  return sessionsRevoked;
};

export const notifyRemovedFactors = async (
  user: Pick<TSsoLookupUser, "id" | "email" | "locale">,
  reclaimed: TReclaimOutcome
): Promise<void> => {
  // The strip is correct for a squatter and a silent security downgrade for the owner — and on a
  // default self-hosted install, where verification blocks nothing, the owner is the likelier of the
  // two. Nothing here can distinguish them, so the answer is to say what happened rather than to
  // weaken the guard.
  //
  // After commit and best-effort, for the same reason the session revocation in `completeSsoRecovery`
  // is: the strip has already landed, and a mailer failure must not turn a completed recovery into a
  // failed sign-in.
  const twoFactorRemoved = Boolean(
    reclaimed && (reclaimed.twoFactorRowsRemoved > 0 || reclaimed.legacyTwoFactorDisarmed)
  );
  const passwordRemoved = Boolean(
    reclaimed && (reclaimed.credentialPasswordsCleared > 0 || reclaimed.legacyPasswordCleared)
  );
  // For a legitimate owner this is the line with a blast radius: integrations they built stop working,
  // so the mail has to say so even when neither sign-in factor was set (ENG-2634).
  const apiKeysRemoved = Boolean(reclaimed && reclaimed.apiKeysRevoked > 0);
  if (passwordRemoved || twoFactorRemoved || apiKeysRemoved) {
    try {
      const sent = await sendSsoRecoveryFactorsRemovedEmail({
        email: user.email,
        locale: user.locale,
        passwordRemoved,
        twoFactorRemoved,
        apiKeysRemoved,
      });
      // `sendEmail` returns false without throwing when SMTP is unconfigured, so the catch below never
      // sees it. Silence there would mean a user's second factor was removed and nobody — not them, not
      // the operator — was told, which is the whole failure this notification exists to prevent.
      if (!sent) {
        logger.error(
          { userId: user.id, passwordRemoved, twoFactorRemoved, apiKeysRemoved },
          "SSO recovery removed local sign-in factors but the notification email was not sent"
        );
      }
    } catch (error) {
      logger.error(
        { ...loggableError(error), userId: user.id },
        "Failed to notify the user that SSO recovery removed their local sign-in factors"
      );
    }
  }
};

/**
 * Every check a recovery must pass before anything is written, shared by the confirmation page (which
 * only shows what would be linked) and the completion POST (which links it), so the page can never
 * offer a recovery the POST would refuse. Throws `SsoRecoveryError`; audits each refusal.
 */
