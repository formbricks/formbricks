import "server-only";
import { APIError, BASE_ERROR_CODES } from "@better-auth/core/error";
import { isAPIError } from "better-auth/api";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

const SIGN_IN_PATH = "/sign-in/email";

/**
 * The response Better Auth's router builds for its own wrong-password `APIError` (`toResponse` in
 * better-call): the error's body as JSON, its status and its status name.
 */
const toErrorResponse = (error: APIError): Response =>
  new Response(JSON.stringify(error.body), {
    status: error.statusCode,
    statusText: error.status.toString(),
    headers: { "Content-Type": "application/json" },
  });

/**
 * Better Auth `after` hook: answer a correct password on an unverified account exactly like every other
 * failed password sign-in (ENG-2099, finishing ENG-670).
 *
 * Better Auth checks `requireEmailVerification` only after the password matched and then throws 403
 * `EMAIL_NOT_VERIFIED`, while an unknown address, an account without a credential or a password, and a
 * wrong password all get 401 `INVALID_EMAIL_OR_PASSWORD`. Signing up with an address (which creates an
 * unverified account only when the address is free) and then signing in with the same pair therefore told
 * anyone whether the address had a Formbricks account.
 *
 * Rewritten here rather than by patching Better Auth, and after the endpoint has run: Better Auth sends the
 * fresh verification link before it throws (`emailVerification.sendOnSignIn`), so the user's way to verify
 * is kept and moves to their inbox. The error is rebuilt from Better Auth's own code table, so the body is
 * the one its wrong-password branch produces.
 *
 * Over HTTP it returns a `Response` rather than throwing the new error: when an after hook replaces an
 * error, Better Auth's dispatcher keeps the status the endpoint threw (403) and only swaps the body, but it
 * passes a `Response` through as is. A server-side `auth.api.signInEmail` call has no request and gets the
 * thrown `APIError`, whose 401 the dispatcher keeps when it rethrows. The hook cannot see the caller's
 * `asResponse` flag (the dispatcher resets it before the hooks run), so a server-side call that passes
 * `asResponse: true` without a request would still get the 403 status with this body. Only our own code
 * calls that way, and an HTTP request always carries its request.
 *
 * Must run after `auditFailedAuthAfter` and `settleSignInBudgetAfterHandler`, which need the real code:
 * the audit records `email_not_verified` as the internal reason, and the budget spends the unit for it.
 * It replaces the response, so it runs last in `runAfterAuthHooks`.
 */
export const maskUnverifiedSignInAfterHandler = (ctx: AuthHookContext): Response | undefined => {
  if (ctx.path !== SIGN_IN_PATH) return undefined;

  const returned = (ctx.context as { returned?: unknown }).returned;
  if (!isAPIError(returned)) return undefined;
  if ((returned.body as { code?: unknown } | undefined)?.code !== BASE_ERROR_CODES.EMAIL_NOT_VERIFIED.code) {
    return undefined;
  }

  const invalidCredentials = APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
  if (!ctx.request) throw invalidCredentials;
  return toErrorResponse(invalidCredentials);
};
