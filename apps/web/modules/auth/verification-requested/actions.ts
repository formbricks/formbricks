"use server";

import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { logger } from "@formbricks/logger";
import { InvalidInputError, SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE } from "@formbricks/types/errors";
import { ZUserEmail } from "@formbricks/types/user";
import { WEBAPP_URL } from "@/lib/constants";
import { actionClient } from "@/lib/utils/action-client";
import { MAX_CALLBACK_URL_LENGTH, getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  classifySignupIntent,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { SSO_RECOVERY_COMPLETION_PATH, normalizeRoutePathname } from "@/modules/auth/lib/verification-links";
import { deliverVerificationEmail } from "@/modules/auth/verification-requested/lib/deliver-verification-email";
import { applyIPRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { withAuditLogging } from "@/modules/ee/audit-logs/lib/handler";
import { type TSsoRecoveryIntent, readSsoRecoveryIntent } from "@/modules/ee/sso/lib/recovery-intent";

const ZResendVerificationEmailAction = z.object({
  email: ZUserEmail,
  // The same bound `getValidatedCallbackUrl` enforces, so a callback this action accepts is one the
  // rest of the app would accept too — two independent numbers here drifted once already.
  callbackUrl: z.string().max(MAX_CALLBACK_URL_LENGTH).optional(),
});

/**
 * The SSO-recovery intent this resend is for, or null when it is an ordinary verification resend.
 *
 * The email check is not decoration: this action is unauthenticated, so a state id must only unlock a
 * resend for the address it was minted for. That binding used to come free with the intent JWT's
 * signature; it is now an explicit comparison against the stored record (ENG-2783).
 *
 * The read deliberately does not consume the intent — the resent link points at the very same record.
 */
/**
 * What a callback URL turns out to be, from this action's point of view.
 *
 * Three outcomes rather than the nullable pair this used to return, because two of the things it
 * collapsed into `null` need different answers. `notRecovery` is an ordinary verification resend.
 * `expired` is a recovery-shaped URL whose intent is no longer in the store — and it has to be said
 * out loud, because the alternative is telling someone a mail is on its way when none was sent.
 */
type TSsoRecoveryResendResolution =
  | { kind: "recovery"; stateId: string; intent: TSsoRecoveryIntent }
  | { kind: "expired" }
  | { kind: "notRecovery" };

const resolveSsoRecoveryResend = async ({
  callbackUrl,
  userEmail,
}: {
  callbackUrl?: string;
  userEmail: string;
}): Promise<TSsoRecoveryResendResolution> => {
  const validatedCallbackUrl = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL);
  if (!validatedCallbackUrl) {
    return { kind: "notRecovery" };
  }

  const parsedCallbackUrl = new URL(validatedCallbackUrl);
  // Through the shared normaliser, not a bare `!==` on `pathname`: Next resolves `…/complete/` and
  // `/api//auth/…/complete` to the completion route, and a stricter comparison here would make the
  // resend silently no-op while this action still reported success.
  if (normalizeRoutePathname(validatedCallbackUrl) !== SSO_RECOVERY_COMPLETION_PATH) {
    return { kind: "notRecovery" };
  }

  const stateId = parsedCallbackUrl.searchParams.get("state");
  if (!stateId) {
    return { kind: "notRecovery" };
  }

  const intent = await readSsoRecoveryIntent(stateId);

  // Nothing stored under a recovery-shaped state. The store cannot say whether it expired, was already
  // consumed, or never existed — `readSsoRecoveryIntent` logs the miss as exactly that ambiguity — so
  // all three answer the same way. Reporting the aged-out case honestly is what matters; a state
  // someone invented learns nothing from the message, having supplied it.
  if (!intent) {
    return { kind: "expired" };
  }

  // A live intent belonging to someone else stays silent, deliberately. Saying "expired" here would
  // answer a question about another account's state to whoever holds the id.
  if (intent.email.toLowerCase() !== userEmail.toLowerCase()) {
    return { kind: "notRecovery" };
  }

  return { kind: "recovery", stateId, intent };
};

/**
 * Re-point the sign-up intent cookie at the link a resend is about to mail (ENG-2562).
 *
 * The cookie's clock starts at sign-up while every resent link gets a fresh hour, so without this a
 * resend's link outlives the cookie and the sign-up browser itself lands on the withheld path. Strictly a
 * refresh — the browser must already hold a valid cookie naming THIS user — so it extends evidence the
 * browser has, and never arms one that lacks it: an unauthenticated caller must not be able to mint
 * sign-up proof for an arbitrary account by asking for a resend. A browser whose cookie has already
 * expired therefore stays on the withheld path (documented residual).
 *
 * Stays in the request, not in `after()`: a cookie cannot be set once the response has gone. Non-fatal:
 * the cookie buys UX only, so a failure must cost exactly the auto-sign-in, never the resend.
 */
const refreshSignupIntentCookie = async (userId: string): Promise<void> => {
  try {
    const cookieStore = await cookies();
    if (classifySignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE_NAME)?.value, userId) === "valid") {
      cookieStore.set(
        SIGNUP_INTENT_COOKIE_NAME,
        createSignupIntentToken(userId),
        SIGNUP_INTENT_COOKIE_OPTIONS
      );
    }
  } catch (error) {
    logger.error({ err: error, userId }, "Failed to refresh the sign-up intent cookie on resend");
  }
};

/**
 * Resend the verification (or SSO-recovery) email. Enumeration-safe (ENG-7092, as ENG-3639 did for
 * forgot-password): an unknown address, a verified account, a spent per-account budget and a mail that
 * was sent all answer `{ success: true }` in the same time, because the budget and the send run in
 * `after()`. Before it answers it does only the IP limit and a lookup, which cost the same either way.
 *
 * The one distinct answer is an expired SSO-recovery link. It is derived from the callback's state id
 * alone, before any account lookup, so it says nothing about whether the address is registered.
 */
export const resendVerificationEmailAction = actionClient.inputSchema(ZResendVerificationEmailAction).action(
  withAuditLogging("verificationEmailSent", "user", async ({ ctx, parsedInput }) => {
    await applyIPRateLimit(rateLimitConfigs.auth.verifyEmail);

    const validatedCallbackUrl = getValidatedCallbackUrl(parsedInput.callbackUrl, WEBAPP_URL) ?? undefined;
    const resolution = await resolveSsoRecoveryResend({
      callbackUrl: validatedCallbackUrl,
      userEmail: parsedInput.email,
    });

    // Said out loud rather than folded into the success below. The intent's ceiling is ~15 minutes, so
    // this is the ordinary outcome for someone who comes back to the page later — and the paired TTL
    // means a resend near the ceiling would post a link that is dead on arrival anyway. Restarting SSO
    // sign-in is the only way out, and nothing else on this page says so.
    if (resolution.kind === "expired") {
      throw new InvalidInputError(SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE);
    }

    const user = await getUserByEmail(parsedInput.email);
    const ssoRecoveryResend = resolution.kind === "recovery" ? resolution : null;
    if (!user || (user.emailVerified && !ssoRecoveryResend)) {
      // Nothing to send, and no account to attribute an audit record to. Past this point the event records
      // that a send was requested for this account: the send itself runs in `after()`, where a spent
      // per-account budget can still skip it (`deliverVerificationEmail` logs that).
      ctx.auditLoggingCtx.suppressEvent = true;
      return { success: true };
    }

    ctx.auditLoggingCtx.userId = user.id;
    if (!ssoRecoveryResend) {
      await refreshSignupIntentCookie(user.id);
    }

    // Copied while the request is live: Better Auth reads them after the response has gone.
    const requestHeaders = new Headers(await headers());
    after(() =>
      deliverVerificationEmail({
        user,
        callbackUrl: validatedCallbackUrl,
        ssoRecoveryResend,
        requestHeaders,
      })
    );

    return { success: true };
  })
);
