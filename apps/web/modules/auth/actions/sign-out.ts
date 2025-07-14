"use server";

import { logSignOut } from "@/modules/auth/lib/utils";
import { logger } from "@formbricks/logger";

/**
 * Logs a sign out event
 * @param userId - The ID of the user who signed out
 * @param userEmail - The email of the user who signed out
 * @param context - The context of the sign out event
 */
export const logSignOutAction = async (
  userId: string,
  userEmail: string,
  context: {
    reason?:
      | "user_initiated"
      | "account_deletion"
      | "email_change"
      | "session_timeout"
      | "forced_logout"
      | "password_reset";
    redirectUrl?: string;
    organizationId?: string;
  }
) => {
  try {
    logSignOut(userId, userEmail, context);
  } catch (error) {
    logger.error("Failed to log sign out event", {
      userId,
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    // Re-throw to ensure callers are aware of the failure
    throw error;
  }
};
