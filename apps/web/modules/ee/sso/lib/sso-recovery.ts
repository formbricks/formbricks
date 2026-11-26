import { prisma } from "@formbricks/database";
import type { IdentityProvider } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { Account } from "@formbricks/types/auth";
import { MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS } from "@/lib/authzed/mcp-grant-timeouts";
import { WEBAPP_URL } from "@/lib/constants";
import { createEmailToken } from "@/lib/jwt";
import { loggableError } from "@/lib/utils/loggable-error";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { finalizeSuccessfulSignIn } from "@/modules/auth/lib/sign-in-tracking";
import { buildVerificationRequestedPath } from "@/modules/auth/lib/verification-links";
import { sendVerificationEmail } from "@/modules/email";
import { TSsoAccountLinkInput, TSsoLookupUser, syncSsoIdentityForUser } from "./account-linking";
import { getSsoRecoveryLogger, queueSsoRecoveryAuditEvent } from "./recovery-audit";
import {
  type TSsoRecoveryAccess,
  authorizeSsoRecovery,
  recordLostSsoRecoveryClaim,
  rejectSsoRecoveryUserMismatch,
} from "./recovery-authorize";
import { claimSsoRecoveryIntent, consumeSsoRecoveryIntent, createSsoRecoveryIntent } from "./recovery-intent";
import {
  SsoRecoveryError,
  createSsoRecoveryCompletionUrl,
  resolveRecoveryCallbackUrl,
} from "./recovery-outcomes";
import {
  notifyRemovedFactors,
  reclaimUnverifiedLocalAuthIfNeeded,
  settleReclaimedCredentials,
} from "./recovery-reclaim";

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
  const originalCallbackUrl = resolveRecoveryCallbackUrl(callbackUrl);

  try {
    const stateId = await createSsoRecoveryIntent({
      userId: existingUser.id,
      email: existingUser.email,
      provider,
      providerAccountId: account.providerAccountId,
      callbackUrl: originalCallbackUrl,
    });
    const completionUrl = createSsoRecoveryCompletionUrl(stateId);

    await sendVerificationEmail({
      id: existingUser.id,
      email: existingUser.email,
      locale: existingUser.locale,
      callbackUrl: completionUrl,
      purpose: "sso_recovery",
      ssoRecoveryStateId: stateId,
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
        ...loggableError(error),
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
 * Tells the account holder what recovery removed (ENG-2633), when it removed anything. Best-effort:
 * a mailer failure is logged, never thrown.
 */

export const completeSsoRecovery = async ({
  stateId,
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
  const { intent, provider, user } = await authorizeSsoRecovery({ stateId, recoveryProof, sessionUserId });

  // Only one request acts on a recovery: a Cancel holding the claim, or one that already spent the
  // intent, stops this link before it writes anything.
  const claim = await claimSsoRecoveryIntent(stateId);
  if (claim.kind !== "claimed") {
    recordLostSsoRecoveryClaim(intent, provider, claim.kind);
    throw new SsoRecoveryError("intent_unusable");
  }

  // Kept when the link committed but the intent could not be spent: released, it would let a later
  // Cancel claim the still-live intent and record a cancellation for an identity that is linked.
  let keepClaim = false;
  let reclaimed: Awaited<ReturnType<typeof reclaimUnverifiedLocalAuthIfNeeded>>;
  try {
    reclaimed = await prisma.$transaction(
      async (tx) => {
        // The address was checked against the intent before the claim; check it again here, holding the
        // user row, so an email change cannot commit between that check and the link. FOR UPDATE makes a
        // concurrent change wait for this transaction instead of slipping in after a plain read.
        //
        // `emailVerified` is re-read under the same lock because it decides the reclaim. Two recoveries for
        // one user hold different intents, so both can pass the guards; the second then waits here while
        // the first verifies the address. Deciding from the read taken before the lock, it would strip
        // again and sweep the sessions the first recovery kept.
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
      },
      // It may end the user's MCP grants, whose rows a reconciling pass can hold: the Revoke timeout.
      { timeout: MCP_GRANT_REVOKE_TRANSACTION_TIMEOUT_MS }
    );

    // Single use, applied at the only point where it is safe to: the link has committed, so the intent
    // has done its job and a replay would only redo work. Not on read — see the note above the read.
    // Best-effort inside the helper: the account is already linked, and a Redis hiccup here must not turn
    // a completed recovery into a failure. The record expires on its own.
    keepClaim = !(await consumeSsoRecoveryIntent(stateId));
  } finally {
    // After a rollback this frees the recovery for a retry; after a link the intent is already gone.
    if (!keepClaim) await claim.release();
  }

  // Only when factors were actually stripped: this is the account changing hands, so any session the
  // squatter still holds has to go. Reachable in practice because `signUpEmail` writes
  // `emailVerified: false` regardless of `requireEmailVerification`, so on an instance with
  // EMAIL_VERIFICATION_DISABLED=1 (the shipped .env.example and docker-compose default) an unproven
  // account can sign in and hold a live session for up to SESSION_MAX_AGE.
  //
  // After commit, never inside the transaction: Better Auth resolves its adapter from its own
  // AsyncLocalStorage, so this would run outside `tx` and outlive a rollback. Best-effort for the same
  // reason the strip must not be undone by a revocation failure — it has already committed.
  const sessionsRevoked = reclaimed ? await settleReclaimedCredentials(reclaimed, user.id, sessionToken) : 0;

  await notifyRemovedFactors(user, reclaimed);

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
