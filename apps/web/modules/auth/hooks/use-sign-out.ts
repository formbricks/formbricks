import { logSignOutAction } from "@/modules/auth/actions/sign-out";
import { signOut } from "next-auth/react";
import { logger } from "@formbricks/logger";

interface UseSignOutOptions {
  reason?:
    | "user_initiated"
    | "account_deletion"
    | "email_change"
    | "session_timeout"
    | "forced_logout"
    | "password_reset";
  redirectUrl?: string;
  organizationId?: string;
  redirect?: boolean;
  callbackUrl?: string;
}

interface SessionUser {
  id: string;
  email?: string;
}

/**
 * Custom hook to handle sign out with audit logging
 * @param sessionUser - The current user session data (optional)
 * @returns {Object} - An object containing the signOutWithAudit function
 */
export const useSignOut = (sessionUser?: SessionUser | null) => {
  const signOutWithAudit = async (options?: UseSignOutOptions) => {
    // Log audit event before signing out (server action)
    if (sessionUser?.id) {
      try {
        await logSignOutAction(sessionUser.id, sessionUser.email ?? "", {
          reason: options?.reason || "user_initiated", // NOSONAR // We want to check for empty strings
          redirectUrl: options?.redirectUrl || options?.callbackUrl, // NOSONAR // We want to check for empty strings
          organizationId: options?.organizationId,
        });
      } catch (error) {
        // Don't block signOut if audit logging fails
        logger.error("Failed to log signOut event:", error);
      }
    }

    // Call NextAuth signOut
    return await signOut({
      redirect: options?.redirect,
      callbackUrl: options?.callbackUrl,
    });
  };

  return { signOut: signOutWithAudit };
};
