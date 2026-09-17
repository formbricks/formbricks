import { logger } from "@formbricks/logger";
import { FORMBRICKS_ENVIRONMENT_ID_LS, FORMBRICKS_WORKSPACE_ID_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";

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
  clearWorkspaceId?: boolean;
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
export const useSignOut = (_sessionUser?: SessionUser | null) => {
  const signOutWithAudit = async (options?: UseSignOutOptions) => {
    if (options?.clearWorkspaceId) {
      localStorage.removeItem(FORMBRICKS_WORKSPACE_ID_LS);
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
    }

    // Better Auth sign-out clears the BA session; the redirect is manual (BA's signOut doesn't take
    // redirect/callbackUrl like NextAuth's did). Mirror NextAuth's contract: navigate by default, or
    // return { url } when the caller passes redirect:false so it can navigate itself. Logout must
    // ALWAYS navigate away even if the BA /sign-out call fails (audited by the native boundary), so
    // swallow+log and fall through to the redirect/return.
    const url = options?.callbackUrl ?? "/auth/login";
    try {
      // The BA client resolves HTTP failures as { error } rather than throwing, so log both shapes.
      const { error } = await authClient.signOut();
      if (error) {
        logger.error(new Error(error.message ?? "signOut returned an error"), "Better Auth signOut failed");
      }
    } catch (error) {
      logger.error(error instanceof Error ? error : new Error(String(error)), "Better Auth signOut failed");
    }
    if (options?.redirect === false) {
      return { url };
    }
    globalThis.location.href = url;
  };

  return { signOut: signOutWithAudit };
};
