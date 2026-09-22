import "server-only";
import { BootstrapAdminMarker } from "@formbricks/database/prisma";
import { isSignupEmailDomainBlocked } from "@/modules/auth/lib/signup-email-domain";
import { resolveUninvitedSignupAdmission, signupDisabledError } from "@/modules/auth/lib/signup-policy";
import { isBootstrapAdminSignup, isSignupDomainAllowed } from "@/modules/auth/lib/signup-request-context";

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
 * `false` blocks the insert silently, a throw blocks it with an error the endpoint surfaces,
 * `{ data }` merges into the row being inserted, and `undefined` continues with the defaults.
 */
export const enforceCredentialSignupBackstop = async (
  email: string
): Promise<false | { data: { isBootstrapAdmin: BootstrapAdminMarker } } | undefined> => {
  // createUserAction runs the full personal-email policy (Cloud gate + invite exemption) and marks the
  // request scope before calling signUpEmail. If that mark is absent, this is a direct POST to Better
  // Auth's native /sign-up/email — which bypasses the action — so both re-checks below re-enforce what
  // the action would have applied (no invite is carried on that raw path).
  if (isSignupDomainAllowed()) {
    // ENG-2247: the action already decided, and recorded WHY it admitted this sign-up. Stamp the
    // marker here rather than there because this is the only point that can reach the insert.
    return isBootstrapAdminSignup()
      ? { data: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin } }
      : undefined;
  }

  if (await isSignupEmailDomainBlocked(email, async () => false)) {
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
  const admission = await resolveUninvitedSignupAdmission();
  if (admission === "denied") {
    throw signupDisabledError();
  }

  // ENG-2247: the fresh-instance exception admits exactly one account, and the unique index on this
  // column is what enforces that — two concurrent sign-ups both read `user.count() === 0`, but only
  // one INSERT can carry the marker. "open" must NOT be marked: on Cloud every sign-up takes that
  // branch, and the second one would collide.
  return admission === "fresh-instance"
    ? { data: { isBootstrapAdmin: BootstrapAdminMarker.bootstrapAdmin } }
    : undefined;
};
