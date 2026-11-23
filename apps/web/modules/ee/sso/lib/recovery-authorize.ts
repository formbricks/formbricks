import "server-only";
import { prisma } from "@formbricks/database";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { LINKED_SSO_LOOKUP_SELECT } from "./account-linking";
import { type TSsoIdentityProvider, normalizeSsoProvider } from "./provider-normalization";
import { getSsoRecoveryLogger, queueSsoRecoveryAuditEvent } from "./recovery-audit";
import {
  type TSsoRecoveryIntent,
  claimSsoRecoveryIntent,
  consumeSsoRecoveryIntent,
  readSsoRecoveryIntent,
} from "./recovery-intent";
import { SsoRecoveryError } from "./recovery-outcomes";
import { isValidSsoRecoveryProof } from "./recovery-proof";

/** What a browser brings to act on a recovery: which one, and the proof and session it holds. */
export type TSsoRecoveryAccess = {
  stateId: string;
  /** The proof cookie set when this browser opened the emailed link (`recovery-proof.ts`). */
  recoveryProof?: string;
  sessionUserId?: string;
};

/**
 * The account's address no longer matches the one recovery was started for. Logged, audited and refused,
 * from the guard and again from inside the linking transaction, so a change that lands in between leaves
 * the same trace.
 */
export const rejectSsoRecoveryUserMismatch = (intent: TSsoRecoveryIntent): SsoRecoveryError => {
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

export const authorizeSsoRecovery = async ({ stateId, recoveryProof, sessionUserId }: TSsoRecoveryAccess) => {
  // Reads without consuming. The completion URL sits in an email, and mail security gateways fetch
  // every link in a message before the human sees it — burning the intent on read would let a scanner
  // spend it and lock the real user out. It is consumed after the link commits instead.
  const intent = await readSsoRecoveryIntent(stateId);

  if (!intent) {
    getSsoRecoveryLogger("sso_recovery_failed").error(
      {},
      "Missing, expired or malformed SSO recovery intent"
    );
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
    throw new SsoRecoveryError("rejected");
  }

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

  return { intent, provider, user };
};

/**
 * What the confirmation page shows before the account holder chooses to link (ENG-7395): the provider
 * that would be linked. Runs every completion guard and writes nothing, so a page view cannot link,
 * strip or consume anything, and a browser the POST would refuse is refused here first.
 */
export const getSsoRecoveryConfirmation = async (
  args: TSsoRecoveryAccess
): Promise<{ provider: TSsoIdentityProvider; email: string }> => {
  const { provider, user } = await authorizeSsoRecovery(args);
  // The account's own address, so the reader can tell whose account they are about to change. A browser
  // signed in to someone else's account (planted by that someone's own recovery link) shows their
  // address here, not the reader's.
  return { provider, email: user.email };
};

const LOST_CLAIM_REASONS = {
  held: "claimed_by_another_request",
  spent: "intent_already_spent",
  unavailable: "claim_unavailable",
} as const;

/** Leaves a trace of a Link or Cancel that could not claim the recovery, and why (ENG-7395). */
export const recordLostSsoRecoveryClaim = (
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
 * The account holder declined on the confirmation page (ENG-7395). Spends the intent so the link can no
 * longer complete anything, from this browser or any other, and records why. Runs the same guards as a
 * completion, so only the browser that could have linked can cancel.
 */
export const cancelSsoRecovery = async (args: TSsoRecoveryAccess): Promise<void> => {
  const { intent, provider } = await authorizeSsoRecovery(args);

  // A Link in flight holds the claim, and a spent intent cannot be claimed: either way this cancel did
  // not happen, so no cancellation is recorded.
  const claim = await claimSsoRecoveryIntent(args.stateId);
  if (claim.kind !== "claimed") {
    recordLostSsoRecoveryClaim(intent, provider, claim.kind);
    throw new SsoRecoveryError("intent_unusable");
  }

  try {
    // A Redis failure on the delete leaves the intent until it expires; the user is told it is unusable.
    if (!(await consumeSsoRecoveryIntent(args.stateId))) {
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
