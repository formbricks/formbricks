"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZUserEmail } from "@formbricks/types/user";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { startAccountDeletionSsoReauthentication } from "@/modules/account/lib/account-deletion-sso-reauth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";

const ZDeleteUserConfirmation = z
  .object({
    confirmationEmail: z.string().trim().pipe(ZUserEmail),
    password: z.string().max(128).optional(),
  })
  .strict();

const ZStartAccountDeletionSsoReauth = z
  .object({
    confirmationEmail: z.string().trim().pipe(ZUserEmail),
    returnToUrl: z.string().trim().max(2048).pipe(z.url()),
  })
  .strict();

const logAccountDeletionError = (userId: string, error: unknown) => {
  logger.error({ error, userId }, "Account deletion failed");
};

export const startAccountDeletionSsoReauthenticationAction = authenticatedActionClient
  .inputSchema(ZStartAccountDeletionSsoReauth)
  .action(async ({ ctx, parsedInput }) => {
    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      const { confirmationEmail, returnToUrl } = parsedInput;

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

export const deleteUserAction = authenticatedActionClient.inputSchema(ZDeleteUserConfirmation).action(
  withAuditLogging("deleted", "user", async ({ ctx, parsedInput }) => {
    ctx.auditLoggingCtx.userId = ctx.user.id;

    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, ctx.user.id);

      const { confirmationEmail, password } = parsedInput;

      const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
        confirmationEmail,
        password,
        userEmail: ctx.user.email,
        userId: ctx.user.id,
      });
      ctx.auditLoggingCtx.oldObject = oldUser;

      capturePostHogEvent(ctx.user.id, "delete_account");

      return { success: true };
    } catch (error) {
      logAccountDeletionError(ctx.user.id, error);
      throw error;
    }
  })
);
