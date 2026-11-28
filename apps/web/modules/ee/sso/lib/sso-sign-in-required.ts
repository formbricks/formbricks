/**
 * The refusal of a password sign-in for an account that must use SSO (ENG-2590), as both sides read it:
 * the session gate writes this body, and the login form recognizes it. Kept free of server-only imports so
 * the form can share the one definition.
 */
export const SSO_SIGN_IN_REQUIRED_CODE = "SSO_SIGN_IN_REQUIRED";

export type TSsoSignInRequiredBody = {
  code: typeof SSO_SIGN_IN_REQUIRED_CODE;
  message: string;
  /** What the login page calls the providers the user can sign in with, in display order. */
  providerNames: string[];
};

/**
 * The provider names carried by an SSO-required refusal, or null for any other error. The client's error
 * object is the response body spread with the status, so anything else, a malformed body included,
 * falls back to the caller's generic handling.
 */
export const getSsoSignInRequiredProviderNames = (error: unknown): string[] | null => {
  if (typeof error !== "object" || error === null) return null;
  const { code, providerNames } = error as { code?: unknown; providerNames?: unknown };
  if (code !== SSO_SIGN_IN_REQUIRED_CODE || !Array.isArray(providerNames)) return null;

  const names = providerNames.filter((name): name is string => typeof name === "string" && name !== "");
  return names.length > 0 ? names : null;
};
