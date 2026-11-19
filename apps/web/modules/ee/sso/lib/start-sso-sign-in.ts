import toast from "react-hot-toast";
import { FORMBRICKS_LOGGED_IN_WITH_LS } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";

type TSsoSignInProvider = "google" | "github" | "azuread" | "openid" | "saml";

interface StartSsoSignInParams {
  provider: TSsoSignInProvider;
  callbackURL: string;
  /** Stored as the "last used" sign-in method once the redirect to the provider has started. */
  lastUsedLabel: string;
  /** Shown when the sign-in cannot start. */
  errorMessage: string;
}

/**
 * Starts an SSO sign-in from a button click. Better Auth fails in two shapes (ENG-3465): a request
 * that never completes (offline, reset, blocked) rejects, while an HTTP error resolves with
 * `{ error }`. Both are turned into a toast here, so a failed click is never silent and never an
 * unhandled rejection. Returns whether the redirect to the provider started, so a caller with a
 * loading state can reset it.
 */
export const startSsoSignIn = async ({
  provider,
  callbackURL,
  lastUsedLabel,
  errorMessage,
}: StartSsoSignInParams): Promise<boolean> => {
  let started: boolean;
  try {
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL,
      // OAuth failures redirect here so the login page's existing ?error= UX surfaces them (parity).
      errorCallbackURL: "/auth/login",
    });
    started = !error;
  } catch {
    started = false;
  }

  if (!started) {
    toast.error(errorMessage);
    return false;
  }

  // Only a sign-in that started marks the provider as last used. A browser that denies storage must
  // not turn a started redirect into an error.
  try {
    localStorage.setItem(FORMBRICKS_LOGGED_IN_WITH_LS, lastUsedLabel);
  } catch {
    // The "last used" hint is a convenience; losing it is harmless.
  }
  return true;
};
