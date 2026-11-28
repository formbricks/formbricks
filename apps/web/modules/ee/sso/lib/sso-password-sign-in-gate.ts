import "server-only";
import { APIError } from "better-auth/api";
import { type TSsoLinkedUser, getOfferedSsoProviders } from "./linked-sso-providers";
import { getSsoProviderDisplayNames } from "./provider-display-name";
import { SSO_SIGN_IN_REQUIRED_CODE, type TSsoSignInRequiredBody } from "./sso-sign-in-required";

const PASSWORD_SIGN_IN_PATH = "/sign-in/email";

/**
 * Session-creation check (ENG-2590), run by `gateSessionCreate`: an account linked to SSO signs in with
 * SSO while this instance offers one of its providers. Otherwise a password left on the account is a
 * second way in that skips everything the identity provider enforces: MFA, conditional access, and
 * deprovisioning, so a user removed from the IdP could keep signing in.
 *
 * - Linked to SSO means `identityProvider` is not `email`. A password user is never touched here.
 * - When none of the user's providers is offered (a lapsed licence, SAML without its licence, a provider
 *   the operator unconfigured), the password works again, so nobody is locked out. Once a provider is
 *   offered again, so is the refusal. The forgot-password flow follows the same rule.
 *
 * Why session creation and not a `hooks.before` on the endpoint: Better Auth creates the session only
 * after the password verified and the email-verification check passed. Only a caller who already knows
 * the password learns the account uses SSO; an unknown address, a wrong password, and an unverified
 * account all keep answering exactly as before. The path check keeps the gate off every other way a
 * session is minted: the SSO callbacks, the recovery sign-in, and the two-factor verify that follows a
 * password step this check has already passed. Better Auth sets the path for in-process
 * `auth.api.signInEmail` calls too.
 *
 * A failed account lookup throws, so the sign-in fails rather than slipping through. The licence check
 * does not throw: an unreachable licence server past its grace period reads as unlicensed, which hides the
 * SSO buttons and so, by the rule above, lets the password back in.
 */
export const requireSsoSignInForSsoLinkedUser = async (
  user: TSsoLinkedUser,
  path: string | undefined
): Promise<void> => {
  if (path !== PASSWORD_SIGN_IN_PATH) return;

  // Empty for a password user without a query, so `email` accounts are never touched here.
  const offered = await getOfferedSsoProviders(user);
  if (offered.length === 0) return;

  const providerNames = getSsoProviderDisplayNames(offered);
  const body: TSsoSignInRequiredBody = {
    code: SSO_SIGN_IN_REQUIRED_CODE,
    // English fallback for clients that do not translate the code; the login form does.
    message: `Your account uses single sign-on. Sign in with ${providerNames.join(" or ")}.`,
    providerNames,
  };
  throw new APIError("FORBIDDEN", body);
};
