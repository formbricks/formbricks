import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request scope carrying "this request just verified an email" from Better Auth's
 * `afterEmailVerification` hook to the `hooks.after` chain (ENG-2562).
 *
 * The two halves of the ENG-2562 fix run in different places and neither can see the other directly:
 * `afterEmailVerification(user, request)` gets the verified user but no endpoint context, so it cannot
 * touch cookies; the `hooks.after` middleware gets the full context but no reliable way to know what
 * just happened. This store joins them.
 *
 * ## Why the response cannot be read instead
 *
 * Deriving "a verification succeeded" from `ctx.context.returned` looks cheaper and is wrong. A
 * successful verification that carries a `callbackURL` — which is every verification reached from a
 * sign-up email, since Better Auth defaults it — finishes as `throw ctx.redirect(...)`, and a thrown
 * redirect is an `APIError`, structurally identical to the failure case. Worse, `/verify-email` also
 * redirects on its already-verified early return, so even "is this a redirect?" does not answer "did
 * this request verify someone?".
 *
 * `afterEmailVerification` answers exactly that and nothing else: Better Auth calls it immediately
 * after the `emailVerified` write and returns before it on the already-verified path, so it fires once
 * per user, on a genuine first verification only. Taking the signal from the framework rather than
 * reverse-engineering its response shape is also what keeps this working across upgrades.
 *
 * Opened by the `/api/auth/[...all]` route around `auth.handler`, alongside the SSO and observability
 * stores. The store survives the awaited handler because the async work starts synchronously inside
 * `run()` — the same guarantee `sso-request-context.ts` and `better-auth-request-context.ts` rely on.
 */
interface EmailVerificationRequestStore {
  /** Id of the user whose email this request verified. Absent on every other request. */
  verifiedUserId?: string;
}

const emailVerificationRequestContext = new AsyncLocalStorage<EmailVerificationRequestStore>();

/** Run `fn` in a fresh scope so a verification in it can be observed by the after-hook chain. */
export const runWithEmailVerificationRequestContext = <T>(fn: () => T): T =>
  emailVerificationRequestContext.run({}, fn);

/** Record, within the current scope, that this request verified `userId`'s email. */
export const markEmailJustVerified = (userId: string): void => {
  const store = emailVerificationRequestContext.getStore();
  if (store) store.verifiedUserId = userId;
};

/**
 * The user this request verified, or `undefined` outside a verification.
 *
 * `undefined` is the safe answer and the common one: it means the auto-sign-in hook mints nothing.
 * It is also what a server-side `auth.api.verifyEmail` call returns, since no store is open there —
 * correct, because there is no browser to hand a cookie to.
 */
export const getJustVerifiedUserId = (): string | undefined =>
  emailVerificationRequestContext.getStore()?.verifiedUserId;
