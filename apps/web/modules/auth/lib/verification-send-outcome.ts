import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped record of whether the verification email actually went out (ENG-2091).
 *
 * Better Auth calls `emailVerification.sendVerificationEmail` through `runInBackgroundOrAwait`, whose
 * catch only logs — so on the SIGN-UP path a throw from the callback is swallowed and `signUpEmail`
 * still resolves 200. The user is then told to check an inbox nothing was sent to, which is
 * indistinguishable from the duplicate-email bug this ticket started from.
 *
 * We cannot change what Better Auth does with the error, so the callback records the outcome here and
 * `createUserAction` reads it back to pick the right screen.
 *
 * WHY THIS WORKS: with no `advanced.backgroundTasks.handler` configured (see auth.ts — there is none),
 * `runInBackgroundOrAwait` `await`s the callback, so it completes inside this scope before
 * `signUpEmail` returns. Configuring a background-task handler would make the send genuinely
 * asynchronous and this outcome unreadable — `signup-verification-send.integration.test.ts` pins the
 * behaviour so that change can't land silently.
 *
 * Distinct from `signup-request-context.ts`, which carries the domain-policy decision INTO the
 * sign-up; this carries the send result back OUT of it.
 */
interface VerificationSendStore {
  failed?: boolean;
}

const verificationSendContext = new AsyncLocalStorage<VerificationSendStore>();

/** Run `fn` in a fresh scope that can observe the verification-email send outcome. */
export const runWithVerificationSendOutcome = <T>(fn: () => T): T => verificationSendContext.run({}, fn);

/** Record, within the current scope, that the verification email could not be sent. */
export const markVerificationSendFailed = (): void => {
  const store = verificationSendContext.getStore();
  if (store) store.failed = true;
};

/**
 * True only when a send was attempted in this scope and failed. Absence of a scope reads as `false`:
 * callers outside a tracked request must not infer a failure from missing information.
 */
export const didVerificationSendFail = (): boolean => verificationSendContext.getStore()?.failed === true;
