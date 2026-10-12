"use server";

import { z } from "zod";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { authenticatedActionClient } from "@/lib/utils/action-client";
import { logSignOut } from "@/modules/auth/lib/utils";

const ZLogSignOutAction = z.object({
  reason: z
    .enum([
      "user_initiated",
      "account_deletion",
      "email_change",
      "session_timeout",
      "forced_logout",
      "password_reset",
    ])
    .optional(),
  redirectUrl: z.string().max(2048).optional(),
  organizationId: ZId.optional(),
});

/**
 * Logs a sign out event for the signed-in user, taken from the session.
 */
export const logSignOutAction = authenticatedActionClient
  .inputSchema(ZLogSignOutAction)
  .action(async ({ ctx, parsedInput }) => {
    try {
      logSignOut(ctx.user.id, ctx.user.email, parsedInput);
    } catch (error) {
      logger.error(
        {
          userId: ctx.user.id,
          context: parsedInput,
          error: error instanceof Error ? error.message : String(error),
        },
        "Failed to log sign out event"
      );
      // Re-throw to ensure callers are aware of the failure
      throw error;
    }
  });
