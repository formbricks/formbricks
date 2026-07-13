import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

interface SignupRequestStore {
  /**
   * Set by `createUserAction` once its personal-email domain policy (Cloud gate + invite exemption)
   * has passed, immediately before it calls `auth.api.signUpEmail`. `user.create.before` reads it to
   * know the credential sign-up already went through the action; its ABSENCE means a direct POST to
   * Better Auth's native `/sign-up/email`, which bypasses the action — the hook re-enforces the block
   * there so it can't be used to skip the gate.
   */
  domainAllowed?: boolean;
}

const signupRequestContext = new AsyncLocalStorage<SignupRequestStore>();

/** Run `fn` in a fresh signup request scope so the credential sign-up hook can read the action's decision. */
export const runWithSignupRequestContext = <T>(fn: () => T): T => signupRequestContext.run({}, fn);

/** Mark, within the current signup scope, that the action's domain policy has already been enforced. */
export const markSignupDomainAllowed = (): void => {
  const store = signupRequestContext.getStore();
  if (store) store.domainAllowed = true;
};

/** True only when the current user creation runs inside an action scope that already enforced the policy. */
export const isSignupDomainAllowed = (): boolean => signupRequestContext.getStore()?.domainAllowed === true;
