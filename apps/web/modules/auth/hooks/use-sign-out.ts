import { logger } from "@formbricks/logger";
import { logoutPlainBeforeNavigation } from "@/app/plain/lib/plain-sdk";
import { FORMBRICKS_ENVIRONMENT_ID_LS, FORMBRICKS_WORKSPACE_ID_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";

interface UseSignOutOptions {
  redirect?: boolean;
  callbackUrl?: string;
  clearWorkspaceId?: boolean;
}

/**
 * Custom hook to sign out. The `userSignedOut` audit event is recorded by the server when Better Auth's
 * `/sign-out` ends the session (`auditSignOutOnSessionDelete`), so nothing here reports it.
 * @returns {Object} - An object containing the signOut function
 */
export const useSignOut = () => {
  const signOut = async (options?: UseSignOutOptions) => {
    if (options?.clearWorkspaceId) {
      localStorage.removeItem(FORMBRICKS_WORKSPACE_ID_LS);
      localStorage.removeItem(FORMBRICKS_ENVIRONMENT_ID_LS);
    }

    // The full page load below never unmounts PlainChat, and Plain persists its session in
    // localStorage, so log the support chat out explicitly or the next person at this browser
    // could open it as this user. Bounded and failure-tolerant: never blocks sign-out.
    await logoutPlainBeforeNavigation();

    // Better Auth sign-out clears the BA session; the redirect is manual (BA's signOut doesn't take
    // redirect/callbackUrl like NextAuth's did). Mirror NextAuth's contract: navigate by default, or
    // return { url } when the caller passes redirect:false so it can navigate itself. Logout must
    // ALWAYS navigate away even if the BA /sign-out call fails (best-effort; audited server-side), so
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

  return { signOut };
};
