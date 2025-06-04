"use server";

import { logSignOut } from "@/modules/auth/lib/utils";

/**
 * Logs a sign out event
 * @param userId - The ID of the user who signed out
 * @param userEmail - The email of the user who signed out
 * @param context - The context of the sign out event
 */
export async function logSignOutAction(
  userId: string,
  userEmail: string,
  context: {
    reason?: "user_initiated" | "account_deletion" | "email_change" | "session_timeout" | "forced_logout";
    redirectUrl?: string;
    organizationId?: string;
  }
) {
  logSignOut(userId, userEmail, context);
}
