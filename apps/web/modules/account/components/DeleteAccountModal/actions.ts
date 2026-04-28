"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { AuthorizationError, InvalidInputError, OperationNotAllowedError } from "@formbricks/types/errors";
import { getOrganizationsWhereUserIsSingleOwner } from "@/lib/organization/service";
import { verifyUserPassword } from "@/lib/user/password";
import { deleteUser, getUser } from "@/lib/user/service";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { getIsMultiOrgEnabled } from "@/modules/ee/license-check/lib/utils";

const ZDeleteUserConfirmation = z
  .object({
    confirmationEmail: z.string().trim().min(1).max(255),
    password: z.string().min(1).max(128),
  })
  .strict();

const SSO_ACCOUNT_DELETION_UNAVAILABLE_ERROR =
  "Account deletion for SSO accounts requires identity-provider reauthentication and is not available here yet. Please contact support to delete this account.";

const parseDeleteUserConfirmation = (input: unknown) => {
  const parsedInput = ZDeleteUserConfirmation.safeParse(input);

  if (!parsedInput.success) {
    throw new InvalidInputError("Password and email confirmation are required to delete your account.");
  }

  return parsedInput.data;
};

const logAccountDeletionError = (userId: string, error: unknown) => {
  logger.error({ error, userId }, "Account deletion failed");
};

export const deleteUserAction = authenticatedActionClient.inputSchema(z.unknown()).action(
  withAuditLogging("deleted", "user", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.userId = ctx.user.id;

    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      if (ctx.user.identityProvider !== "email") {
        throw new OperationNotAllowedError(SSO_ACCOUNT_DELETION_UNAVAILABLE_ERROR);
      }

      const { confirmationEmail, password } = parseDeleteUserConfirmation(parsedInput);

      if (confirmationEmail.toLowerCase() !== ctx.user.email.toLowerCase()) {
        throw new AuthorizationError("Email confirmation does not match");
      }

      const isCorrectPassword = await verifyUserPassword(ctx.user.id, password);
      if (!isCorrectPassword) {
        throw new AuthorizationError("Incorrect credentials");
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

      return { success: true };
    } catch (error) {
      logAccountDeletionError(ctx.user.id, error);
      throw error;
    }
  })
);
