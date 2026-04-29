"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { capturePostHogEvent } from "@/lib/posthog";
import { verifyUserPassword } from "@/lib/user/password";
import { deleteUser, getUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";
import { DELETE_ACCOUNT_WRONG_PASSWORD_ERROR } from "./constants";

const DELETE_USER_CONFIRMATION_REQUIRED_ERROR =
  "Password and email confirmation are required to delete your account.";

const ZDeleteUserConfirmation = z
  .object({
    confirmationEmail: z.string().trim().min(1).max(255),
    password: z.string().max(128).optional(),
  })
  .strict();

const parseDeleteUserConfirmation = (input: unknown) => {
  const parsedInput = ZDeleteUserConfirmation.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError(DELETE_USER_CONFIRMATION_REQUIRED_ERROR);
  }

  return parsedInput.data;
};

const getPasswordOrThrow = (password?: string) => {
  if (!password) {
    throw new InvalidInputError(DELETE_USER_CONFIRMATION_REQUIRED_ERROR);
  }

  return password;
};

const logAccountDeletionError = (userId: string, error: unknown) => {
  logger.error({ error, userId }, "Account deletion failed");
};

export const deleteUserAction = authenticatedActionClient.inputSchema(z.unknown()).action(
  withAuditLogging("deleted", "user", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.userId = ctx.user.id;

    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      const isPasswordBackedAccount = ctx.user.identityProvider === "email";
      const { confirmationEmail, password } = parseDeleteUserConfirmation(parsedInput);

      if (confirmationEmail.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new AuthorizationError("Email confirmation does not match");
      }

      if (isPasswordBackedAccount) {
        const isCorrectPassword = await verifyUserPassword(ctx.user.id, getPasswordOrThrow(password));
        if (!isCorrectPassword) {
          throw new AuthorizationError(DELETE_ACCOUNT_WRONG_PASSWORD_ERROR);
        }
      }

      const isMultiOrgEnabled = await getIsMultiOrgEnabled();
      if (!isMultiOrgEnabled) {
        const organizationsWithSingleOwner = await getOrganizationsWhereUserIsSingleOwner(ctx.user.id);
        if (organizationsWithSingleOwner.length > 0) {
          throw new OperationNotAllowedError(
            "You are the only owner of this organization. Please transfer ownership to another member first."
          );
        }
      }

      ctx.auditLoggingCtx.oldObject = await getUser(ctx.user.id);

      await deleteUser(ctx.user.id);

      capturePostHogEvent(ctx.user.id, "delete_account");

      return { success: true };
    } catch (error) {
      logAccountDeletionError(ctx.user.id, error);
      throw error;
    }
  })
);
