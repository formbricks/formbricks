import type { IdentityProvider, Prisma } from "@prisma/client";
import type { Account } from "next-auth";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { createEmailToken, createSsoRelinkIntent, verifySsoRelinkIntent } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
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
}: {
  action: "sso_recovery_started" | "sso_recovery_completed" | "sso_recovery_failed";
  status: "success" | "failure";
  userId: string;
  email: string;
  provider: string;
  callbackUrl?: string;
  failureReason?: string;
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
    },
  });
};

const SSO_RECOVERY_USER_SELECT = {
  ...LINKED_SSO_LOOKUP_SELECT,
  backupCodes: true,
  password: true,
  twoFactorEnabled: true,
  twoFactorSecret: true,
} as const;

type TSsoRecoveryUser = Prisma.UserGetPayload<{
  select: typeof SSO_RECOVERY_USER_SELECT;
}>;

const reclaimUnverifiedLocalAuthIfNeeded = async ({
  tx,
  user,
}: {
  tx: Prisma.TransactionClient;
  user: TSsoRecoveryUser;
}) => {
  if (user.identityProvider !== "email" || user.emailVerified) {
    return;
  }

  // Inbox ownership is now proven, so strip any untrusted local auth factors before the SSO
  // account becomes the canonical way back in.
  await tx.user.update({
    where: {
      id: user.id,
    },
    data: {
      backupCodes: null,
      emailVerified: new Date(),
      password: null,
      twoFactorEnabled: false,
      twoFactorSecret: null,
    },
  });
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
}: {
  intentToken: string;
  sessionUserId?: string;
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
    select: SSO_RECOVERY_USER_SELECT,
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

  await prisma.$transaction(async (tx) => {
    await reclaimUnverifiedLocalAuthIfNeeded({
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
  });

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
  });

  return getValidatedCallbackUrl(intent.callbackUrl, WEBAPP_URL) ?? WEBAPP_URL;
};
