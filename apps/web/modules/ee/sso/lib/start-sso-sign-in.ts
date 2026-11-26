import toast from "react-hot-toast";
import { FORMBRICKS_LOGGED_IN_WITH_LS, writeLocalStorage } from "@/lib/localStorage";
import { authClient } from "@/modules/auth/lib/auth-client";
import type { TSsoIdentityProvider } from "@/modules/ee/sso/lib/provider-normalization";

/** The "last used" value each provider stores; `SSOOptions` compares against these to mark a button. */
const LAST_USED_LABELS: Record<TSsoIdentityProvider, string> = {
  google: "Google",
  github: "Github",
  azuread: "Azure",
  openid: "OpenID",
  saml: "Saml",
};

/** A request that never completed: fetch rejects with a TypeError, an aborted one with a DOMException. */
const isTransportFailure = (error: unknown): boolean =>
  error instanceof TypeError || error instanceof DOMException;

interface StartSsoSignInParams {
  provider: TSsoIdentityProvider;
  callbackURL: string;
  /** Shown when the sign-in cannot start. */
  errorMessage: string;
}

/**
 * Starts an SSO sign-in from a button click. Better Auth fails in two shapes (ENG-3465): a request
 * that never completes (offline, reset, blocked) rejects, while an HTTP error resolves with
 * `{ error }`. Both become a toast here, so a failed click is never silent and never an unhandled
 * rejection. Returns whether the redirect to the provider started, so a caller with a loading state
 * can reset it.
 */
export const startSsoSignIn = async ({
  provider,
  callbackURL,
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
  } catch (error) {
    if (!isTransportFailure(error)) throw error;
    started = false;
  }

  if (!started) {
    toast.error(errorMessage);
    return false;
  }

  // Only a sign-in that started marks the provider as last used. A browser that denies storage
  // skips the write, which must not turn a started redirect into an error.
  writeLocalStorage(FORMBRICKS_LOGGED_IN_WITH_LS, LAST_USED_LABELS[provider]);
  return true;
};
