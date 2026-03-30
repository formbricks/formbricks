import "server-only";
import { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { InvalidPasswordResetTokenError } from "@formbricks/types/errors";
import type { TUserEmail, TUserLocale } from "@formbricks/types/user";
import { ZUserEmail, ZUserLocale, ZUserPassword } from "@formbricks/types/user";
import { hashPassword } from "@/lib/auth";
import { PASSWORD_RESET_TOKEN_LIFETIME_MINUTES, WEBAPP_URL } from "@/lib/constants";
import { hashString } from "@/lib/hash-string";
import { validateInputs } from "@/lib/utils/validate";
import { sendPasswordResetLinkEmail, sendPasswordResetNotifyEmail } from "@/modules/email";
import {
  consumeActiveToken,
  deleteByUserId,
  findByTokenHash,
  upsertActiveToken,
} from "./password-reset-token-repository";

export const INVALID_PASSWORD_RESET_TOKEN_MESSAGE = "Invalid or expired password reset link.";

const ZPasswordResetSource = z.enum(["public", "profile"]);

const passwordResetAuditSelection = {
  id: true,
  email: true,
  locale: true,
  emailVerified: true,
} satisfies Prisma.UserSelect;

type TPasswordResetRequestSource = z.infer<typeof ZPasswordResetSource>;

type TPasswordResetRecipient = {
  id: string;
  email: TUserEmail;
  locale: TUserLocale;
};

type TPasswordResetAuditUser = Prisma.UserGetPayload<{
  select: typeof passwordResetAuditSelection;
}>;

class PasswordResetLinkEmailError extends Error {
  constructor() {
    super("Password reset email was not sent");
    this.name = "PasswordResetLinkEmailError";
  }
}

class PasswordResetNotificationEmailError extends Error {
  constructor() {
    super("Password reset notification email was not sent");
    this.name = "PasswordResetNotificationEmailError";
  }
}

export const getPasswordResetTokenLifetimeInMinutes = (): number => PASSWORD_RESET_TOKEN_LIFETIME_MINUTES;

const buildPasswordResetLink = (token: string): string =>
  `${WEBAPP_URL}/auth/forgot-password/reset?token=${encodeURIComponent(token)}`;

const isLegacyPasswordResetToken = (token: string): boolean => token.split(".").length === 3;

const logPasswordResetRequestFailure = ({
  error,
  source,
  stage,
  userId,
}: {
  error: unknown;
  source: TPasswordResetRequestSource;
  stage: "issue" | "send" | "revoke";
  userId: string;
}) => {
  logger.error({ error, source, stage, userId }, "Password reset request failed");
};

const logPasswordResetTokenRejection = (error: InvalidPasswordResetTokenError) => {
  logger.warn(
    {
      stage: "consume",
      reason: error.reason ?? "invalid_or_superseded",
      userId: error.userId,
    },
    "Rejected password reset token"
  );
};

const createInvalidPasswordResetTokenError = (
  reason: string,
  userId?: string
): InvalidPasswordResetTokenError =>
  new InvalidPasswordResetTokenError(INVALID_PASSWORD_RESET_TOKEN_MESSAGE, reason, userId);

const getPasswordResetExpiry = (): Date =>
  new Date(Date.now() + getPasswordResetTokenLifetimeInMinutes() * 60 * 1000);

const assertEmailWasSent = (didSendEmail: boolean, error: Error): void => {
  if (!didSendEmail) {
    throw error;
  }
};

const revokeIssuedPasswordResetToken = async (
  userId: string,
  source: TPasswordResetRequestSource
): Promise<void> => {
  try {
    await deleteByUserId(userId);
  } catch (error) {
    logPasswordResetRequestFailure({
      error,
      source,
      stage: "revoke",
      userId,
    });
  }
};

const sendPasswordResetLink = async (user: TPasswordResetRecipient, verifyLink: string): Promise<void> => {
  const didSendEmail = await sendPasswordResetLinkEmail({
    email: user.email,
    locale: user.locale,
    verifyLink,
    linkValidityInMinutes: getPasswordResetTokenLifetimeInMinutes(),
  });

  assertEmailWasSent(didSendEmail, new PasswordResetLinkEmailError());
};

const updatePasswordWithActiveResetToken = async (
  tokenHash: string,
  hashedPassword: string,
  now: Date
): Promise<{
  userId: string;
  oldUser: TPasswordResetAuditUser;
  updatedUser: TPasswordResetAuditUser;
}> =>
  prisma.$transaction(async (tx) => {
    const tokenRecord = await findByTokenHash(tokenHash, tx);

    if (!tokenRecord) {
      throw createInvalidPasswordResetTokenError("invalid_or_superseded");
    }

    if (tokenRecord.expiresAt <= now) {
      throw createInvalidPasswordResetTokenError("expired", tokenRecord.userId);
    }

    const oldUser = await tx.user.findUnique({
      where: {
        id: tokenRecord.userId,
      },
      select: passwordResetAuditSelection,
    });

    if (!oldUser) {
      throw createInvalidPasswordResetTokenError("invalid_or_superseded", tokenRecord.userId);
    }

    const consumedTokenCount = await consumeActiveToken(tokenHash, now, tx);

    if (consumedTokenCount !== 1) {
      throw createInvalidPasswordResetTokenError("replay", tokenRecord.userId);
    }

    const updatedUser = await tx.user.update({
      where: {
        id: tokenRecord.userId,
      },
      data: {
        password: hashedPassword,
      },
      select: passwordResetAuditSelection,
    });

    return {
      userId: tokenRecord.userId,
      oldUser,
      updatedUser,
    };
  });

const sendPasswordResetNotification = async ({
  userId,
  email,
  locale,
}: {
  userId: string;
  email: string;
  locale: TUserLocale;
}): Promise<void> => {
  try {
    const didSendNotificationEmail = await sendPasswordResetNotifyEmail({
      email,
      locale,
    });

    assertEmailWasSent(didSendNotificationEmail, new PasswordResetNotificationEmailError());
  } catch (error) {
    logger.error(
      {
        error,
        stage: "notify_email",
        userId,
      },
      "Failed to send password reset notification email"
    );
  }
};

export const requestPasswordReset = async (
  user: TPasswordResetRecipient,
  source: TPasswordResetRequestSource
): Promise<void> => {
  validateInputs(
    [user.id, ZId],
    [user.email, ZUserEmail],
    [user.locale, ZUserLocale],
    [source, ZPasswordResetSource]
  );

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashString(rawToken);
  const expiresAt = getPasswordResetExpiry();
  const verifyLink = buildPasswordResetLink(rawToken);
  let tokenIssued = false;

  try {
    await upsertActiveToken(user.id, tokenHash, expiresAt);
    tokenIssued = true;
    await sendPasswordResetLink(user, verifyLink);
  } catch (error) {
    logPasswordResetRequestFailure({
      error,
      source,
      stage: tokenIssued ? "send" : "issue",
      userId: user.id,
    });

    if (tokenIssued) {
      await revokeIssuedPasswordResetToken(user.id, source);
    }

    if (source === "profile") {
      throw error;
    }
  }
};

export const completePasswordReset = async (
  rawToken: string,
  password: string
): Promise<{
  userId: string;
  oldUser: TPasswordResetAuditUser;
  updatedUser: TPasswordResetAuditUser;
}> => {
  validateInputs([rawToken, z.string().min(1)], [password, ZUserPassword]);

  if (isLegacyPasswordResetToken(rawToken)) {
    const error = createInvalidPasswordResetTokenError("legacy_jwt");
    logPasswordResetTokenRejection(error);
    throw error;
  }

  const tokenHash = hashString(rawToken);
  const hashedPassword = await hashPassword(password);
  const now = new Date();

  try {
    const result = await updatePasswordWithActiveResetToken(tokenHash, hashedPassword, now);
    await sendPasswordResetNotification({
      userId: result.userId,
      email: result.updatedUser.email,
      locale: result.updatedUser.locale,
    });

    return result;
  } catch (error) {
    if (error instanceof InvalidPasswordResetTokenError) {
      logPasswordResetTokenRejection(error);
      throw error;
    }

    logger.error({ error, stage: "password_update" }, "Password reset completion failed");
    throw error;
  }
};
