import "server-only";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { isUninvitedSignupAllowed, signupDisabledError } from "@/modules/auth/lib/signup-policy";
import { isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";

/**
 * The last-resort signup policy for CREDENTIAL user creation, enforced inside Better Auth's
 * `user.create.before` database hook.
 *
 * It lives here rather than in the SSO hooks module because it is credential policy end to end — it
 * shares nothing with the SSO sign-up flow except the hook slot both are wired into, and the SSO
 * module's own concerns (provisioning gates, identity denormalization, the IdP's email claim) say
 * nothing about it.
 *
 * Return values follow Better Auth's hook contract, which the caller passes through verbatim:
 * `false` blocks the insert silently, a throw blocks it with an error the endpoint surfaces, and
 * `undefined` continues with the defaults.
 */
export const enforceCredentialSignupBackstop = async (email: string): Promise<false | undefined> => {
  // createUserAction runs the full personal-email policy (Cloud gate + invite exemption) and marks the
  // request scope before calling signUpEmail. If that mark is absent, this is a direct POST to Better
  // Auth's native /sign-up/email — which bypasses the action — so re-enforce the domain block here (no
  // invite is carried on that raw path).
  // One read, two guards: both re-checks below exist only for a request that skipped the action.
  const wentThroughAction = isSignupDomainAllowed();
  if (!wentThroughAction && (await isSignupEmailDomainBlocked(email, async () => false))) {
    return false;
  }
  // ENG-2293 BACKSTOP: closed-instance policy (SIGNUP_ENABLED / multi-org / fresh-instance).
  // The primary gate is `signupPolicyBeforeHandler` in auth.ts's `hooks.before`, which rejects
  // `POST /sign-up/email` before Better Auth looks the address up — deliberately NOT here,
  // because this hook only ever runs for an address that does not yet exist (the duplicate
  // branch returns a synthetic 200 without creating anything), so rejecting here and nowhere
  // else would answer "does this address have an account?". See signup-policy.ts.
  //
  // Kept anyway because this hook covers EVERY credential user-creation path, not just the one
  // route the before-hook names: any future Better Auth plugin that creates a user (magic link,
  // email OTP, admin create) lands here, and on a closed instance it should not.
  if (!wentThroughAction && !(await isUninvitedSignupAllowed())) {
    throw signupDisabledError();
  }
  return undefined; // otherwise keep credential-signup defaults
};
