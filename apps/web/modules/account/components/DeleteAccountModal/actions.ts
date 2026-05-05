"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { InvalidInputError } from "@formbricks/types/errors";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { startAccountDeletionSsoReauthentication } from "@/modules/account/lib/account-deletion-sso-reauth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE } from "./constants";

const ZDeleteUserConfirmation = z
  .object({
    confirmationEmail: z.string().trim().min(1).max(255),
    password: z.string().max(128).optional(),
  })
  .strict();

const ZStartAccountDeletionSsoReauth = z
  .object({
    confirmationEmail: z.string().trim().min(1).max(255),
    returnToUrl: z.string().trim().min(1).max(2048),
  })
  .strict();

const parseDeleteUserConfirmation = (input: unknown) => {
  const parsedInput = ZDeleteUserConfirmation.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError(ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE);
  }

  return parsedInput.data;
};

const parseStartAccountDeletionSsoReauthInput = (input: unknown) => {
  const parsedInput = ZStartAccountDeletionSsoReauth.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError(ACCOUNT_DELETION_CONFIRMATION_REQUIRED_ERROR_CODE);
  }

  return parsedInput.data;
};

const logAccountDeletionError = (userId: string, error: unknown) => {
  logger.error({ error, userId }, "Account deletion failed");
};

export const startAccountDeletionSsoReauthenticationAction = authenticatedActionClient
  .inputSchema(z.unknown())
  .action(async ({ ctx, parsedInput }) => {
    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      const { confirmationEmail, returnToUrl } = parseStartAccountDeletionSsoReauthInput(parsedInput);

      return await startAccountDeletionSsoReauthentication({
        confirmationEmail,
        returnToUrl,
        userId: ctx.user.id,
      });
    } catch (error) {
      logger.error({ error, userId: ctx.user.id }, "Account deletion SSO reauthentication failed");
      throw error;
    }
  });

export const deleteUserAction = authenticatedActionClient.inputSchema(z.unknown()).action(
  withAuditLogging("deleted", "user", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.userId = ctx.user.id;

    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      const { confirmationEmail, password } = parseDeleteUserConfirmation(parsedInput);

      const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
        confirmationEmail,
        password,
        userEmail: ctx.user.email,
        userId: ctx.user.id,
      });
      ctx.auditLoggingCtx.oldObject = oldUser;

      return { success: true };
    } catch (error) {
      logAccountDeletionError(ctx.user.id, error);
      throw error;
    }
  })
);
