import "server-only";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { APIError, isAPIError } from "better-auth/api";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { hashString } from "@/lib/hash-string";
import { reserveRateLimitUsage, settleRateLimitUsage } from "@/modules/core/rate-limit/helpers";
import type { TRateLimitReservation } from "@/modules/core/rate-limit/rate-limit";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";

const SIGN_IN_PATH = "/sign-in/email";
// The failures that spend the unit. An unverified account with the right password counts too (ENG-2099):
// its answer is the wrong-password one, and a budget that refunded it would lock out a taken address after
// ten tries but never a free one, telling them apart again through the 429.
const SPENDING_CODES = new Set<string>([
  BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD.code,
  BASE_ERROR_CODES.EMAIL_NOT_VERIFIED.code,
]);
// Where the before hook leaves its receipt for the after hook. Both run on the one request context.
const RESERVATION_KEY = "signInBudgetReservation";

type TReservationHolder = { [RESERVATION_KEY]?: TRateLimitReservation };

/**
 * The account a password sign-in targets, as a rate-limit identifier. Keyed on the address and not on a
 * user row so an unknown address spends and exhausts a budget exactly like a real one: the response never
 * says whether the account exists. Lowercased and trimmed, the way Better Auth matches it, so `A@x.com` and
 * `a@x.com` share a budget.
 */
const signInAccountIdentifier = (body: unknown): string | undefined => {
  const email = (body as { email?: unknown } | undefined)?.email;
  if (typeof email !== "string") return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized ? hashString(normalized) : undefined;
};

/**
 * Better Auth `before` hook: spend one unit of the account's wrong-password budget before the password is
 * checked, and refuse when none is left (SEC-18). The only other limit on `/sign-in/email` is per IP, so a
 * guess run spread over many IPs was bounded by how many IPs it had, not by how many passwords it tried at
 * one account.
 *
 * Reserved up front, atomically, rather than read now and charged after the response: bcrypt makes the
 * check slow, and a read-then-charge budget lets every guess fired at once see an untouched counter.
 * {@link settleSignInBudgetAfterHandler} gives the unit back unless the sign-in failed on its credentials, so
 * a successful sign-in never spends it. Fails closed with Redis down, like every brute-force guard (ADR 0016). The
 * refusal is a 429 whatever the password was, so a locked account does not reveal whether a guess would have
 * been right.
 *
 * Trade-off, chosen on purpose: a stranger can still spend the budget for a victim's address and lock them
 * out of password sign-in until the window passes. That is why the budget refunds everything but a failed
 * credential check, is generous (10 in 15 minutes, far more than a person mistypes), and is a short window
 * rather than a permanent lock; SSO and the password reset (own limits) stay open meanwhile. There is no
 * operator unlock: the window expiring is the unlock.
 */
export const signInBudgetBeforeHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== SIGN_IN_PATH) return;

  const identifier = signInAccountIdentifier(ctx.body);
  if (!identifier) return;

  try {
    const reservation = await reserveRateLimitUsage(
      rateLimitConfigs.auth.loginFailuresPerAccount,
      identifier
    );
    (ctx.context as TReservationHolder)[RESERVATION_KEY] = reservation;
  } catch (error) {
    if (!(error instanceof TooManyRequestsError)) throw error;
    throw new APIError("TOO_MANY_REQUESTS", {
      message: "Too many sign-in attempts. Please try again later.",
      code: "TOO_MANY_ATTEMPTS",
    });
  }
};

/**
 * Better Auth `after` hook: keep the unit the before hook reserved when the password was wrong or the account
 * is unverified (both answer as a wrong password); give it back for a success or any other outcome. A request
 * that never reaches this hook (an unexpected throw) keeps its unit, which errs on the side of the budget.
 */
export const settleSignInBudgetAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== SIGN_IN_PATH) return;

  const reservation = (ctx.context as TReservationHolder)[RESERVATION_KEY];
  if (!reservation) return;

  const returned = (ctx.context as { returned?: unknown }).returned;
  const code = isAPIError(returned) ? (returned.body as { code?: unknown } | undefined)?.code : undefined;
  if (typeof code === "string" && SPENDING_CODES.has(code)) return;

  await settleRateLimitUsage(reservation, 0);
};
