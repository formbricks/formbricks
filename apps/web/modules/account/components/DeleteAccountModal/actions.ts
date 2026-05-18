"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { AuthorizationError } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { capturePostHogEvent } from "@/lib/posthog";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE } from "@/modules/account/constants";
import { deleteUserWithAccountDeletionAuthorization } from "@/modules/account/lib/account-deletion";
import { queueAccountDeletionAuditEvent } from "@/modules/account/lib/account-deletion-audit";
import { startAccountDeletionSsoReauthentication } from "@/modules/account/lib/account-deletion-sso-reauth";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";

const ZDeleteUserConfirmation = z
  .object({
    confirmationEmail: z.string().trim().pipe(ZUserEmail),
    password: z.string().max(128).optional(),
    returnToUrl: z.string().trim().max(2048).pipe(z.url()).optional(),
  })
  .strict();

const logAccountDeletionError = (userId: string, error: unknown) => {
  logger.error({ error, userId }, "Account deletion failed");
};

const isSsoConfirmationRequiredError = (error: unknown) =>
  error instanceof AuthorizationError && error.message === ACCOUNT_DELETION_SSO_REAUTH_REQUIRED_ERROR_CODE;

export const deleteUserAction = authenticatedActionClient
  .inputSchema(ZDeleteUserConfirmation)
  .action(async ({ ctx, parsedInput }) => {
    const userId = ctx.user.id;

    try {
      await applyRateLimit(rateLimitConfigs.actions.accountDeletion, userId);

      const { confirmationEmail, password } = parsedInput;

      const { oldUser } = await deleteUserWithAccountDeletionAuthorization({
        confirmationEmail,
        password,
        userEmail: ctx.user.email,
        userId,
      });
      await queueAccountDeletionAuditEvent({ oldUser, status: "success", targetUserId: userId });

      capturePostHogEvent(userId, "delete_account");

      return { success: true };
    } catch (error) {
      if (isSsoConfirmationRequiredError(error)) {
        const { confirmationEmail, returnToUrl } = parsedInput;

        try {
          return {
            ssoConfirmation: await startAccountDeletionSsoReauthentication({
              confirmationEmail,
              returnToUrl: returnToUrl ?? WEBAPP_URL,
              userId,
            }),
          };
        } catch (ssoConfirmationError) {
          await queueAccountDeletionAuditEvent({
            eventId: ctx.auditLoggingCtx.eventId,
            status: "failure",
            targetUserId: userId,
          });
          logger.error(
            { error: ssoConfirmationError, userId },
            "Account deletion SSO identity confirmation failed"
          );
          throw ssoConfirmationError;
        }
      }

      await queueAccountDeletionAuditEvent({
        eventId: ctx.auditLoggingCtx.eventId,
        status: "failure",
        targetUserId: userId,
      });
      logAccountDeletionError(userId, error);
      throw error;
    }
  });
