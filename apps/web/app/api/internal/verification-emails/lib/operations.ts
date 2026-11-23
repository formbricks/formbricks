import "server-only";
import { cookies, headers } from "next/headers";
import { after } from "next/server";
import { logger } from "@formbricks/logger";
import { SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE } from "@formbricks/types/errors";
import type { TPreLoginRequestContext } from "@/app/api/internal/lib/types";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import { WEBAPP_URL } from "@/lib/constants";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  classifySignupIntent,
  createDecoySignupIntentToken,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { SSO_RECOVERY_COMPLETION_PATH, normalizeRoutePathname } from "@/modules/auth/lib/verification-links";
import { deliverVerificationEmail } from "@/modules/auth/verification-requested/lib/deliver-verification-email";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { type TSsoRecoveryIntent, readSsoRecoveryIntent } from "@/modules/ee/sso/lib/recovery-intent";
import type { TVerificationEmailBody } from "../schemas";

/**
 * The SSO-recovery intent this resend is for, or null when it is an ordinary verification resend.
 *
 * The email check is not decoration: this route is unauthenticated, so a state id must only unlock a
 * resend for the address it was minted for. That binding used to come free with the intent JWT's
 * signature; it is now an explicit comparison against the stored record (ENG-2783).
 *
 * The read deliberately does not consume the intent — the resent link points at the very same record.
 */
/**
 * What a callback URL turns out to be, from this route's point of view.
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
  // resend silently no-op while this route still reported success.
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
 * Shape the sign-up intent cookie on EVERY answer that can be a resend (ENG-2562, ENG-7094).
 *
 * ENG-2562: a resent link gets a fresh hour while the intent cookie's clock started at sign-up, so
 * re-pair a cookie the browser already holds for THIS user. Strictly a refresh — it extends evidence
 * the browser has and never arms one that lacks it, or an unauthenticated caller could mint sign-up
 * proof for an arbitrary account by asking for a resend.
 *
 * ENG-7094: but whether a cookie comes back must not answer "does this address have an account?"
 * either. A resend for a registered, unverified address follows a sign-up that left a decoy; a resend
 * after a sign-up that created the account follows a real cookie. Replying with a refreshed cookie
 * only in the second case completes the two-step existence oracle the decoy exists to close. So an
 * absent, invalid or decoy cookie is replaced with a fresh decoy — same name, attributes and length —
 * and every 204 carries one intent-shaped cookie.
 *
 * Non-fatal, like the sign-up issuance: a failure here costs exactly the auto-sign-in UX, never the
 * resend itself.
 */
const pairSignupIntentCookie = async (userId?: string): Promise<void> => {
  try {
    const cookieStore = await cookies();
    const held = cookieStore.get(SIGNUP_INTENT_COOKIE_NAME)?.value;
    cookieStore.set(
      SIGNUP_INTENT_COOKIE_NAME,
      userId && classifySignupIntent(held, userId) === "valid"
        ? createSignupIntentToken(userId)
        : createDecoySignupIntentToken(),
      SIGNUP_INTENT_COOKIE_OPTIONS
    );
  } catch (error) {
    logger.error({ error, userId }, "Failed to pair the sign-up intent cookie on resend");
  }
};

/** A refusal the page explains: `details.reason` (and `detail`) is the stable code it translates. */
const refused = ({ requestId, instance }: TPreLoginRequestContext, reason: string) =>
  problemUnprocessableContent(requestId, reason, { instance, details: { reason } });

/**
 * `POST /api/internal/verification-emails`: send a new verification email, or an SSO recovery one when the
 * callback is a live recovery for this address (pre-login). Charged to the client's IP; the per-account
 * budget and the send run after the answer (ENG-7092), so an unknown address, a verified account, a spent
 * budget and a sent mail all answer 204 at the same speed.
 */
export async function resendVerificationEmailOperation({
  body,
  ...context
}: TPreLoginRequestContext & { body: TVerificationEmailBody }): Promise<Response> {
  const { requestId, auditLog } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.verifyEmail, context);
  if (limited) {
    // Not audited, unlike the action: the IP budget is what bounds this pre-login route's audit rows, and
    // auditing every refusal past it would be unbounded (the limiter logs it instead).
    skipV3AuditLog(auditLog);
    return limited;
  }

  const validatedCallbackUrl = getValidatedCallbackUrl(body.callbackUrl, WEBAPP_URL) ?? undefined;
  // Derived from the callback's state id alone, before any account lookup, so the answer cannot depend on
  // whether the address is registered.
  const resolution = await resolveSsoRecoveryResend({
    callbackUrl: validatedCallbackUrl,
    userEmail: body.email,
  });

  // Said out loud rather than folded into the success below. The intent's ceiling is ~15 minutes, so
  // this is the ordinary outcome for someone who comes back to the page later — and the paired TTL
  // means a resend near the ceiling would post a link that is dead on arrival anyway. Restarting SSO
  // sign-in is the only way out, and nothing else on this page says so.
  if (resolution.kind === "expired") {
    return refused(context, SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE);
  }

  const user = await getUserByEmail(body.email);
  if (!user) {
    // ENG-7092: no "user not found" answer, or the page is a lookup. A decoy cookie keeps the response
    // shaped like every other resend (ENG-7094), and no event is recorded for an account that isn't there.
    await pairSignupIntentCookie();
    skipV3AuditLog(auditLog);
    return noContentResponse({ requestId });
  }

  // Every answer from here on can be a resend, so shape the intent cookie before the paths diverge:
  // a 204 must never differ by whether the address had an account (ENG-7094).
  await pairSignupIntentCookie(user.id);

  const ssoRecoveryResend = resolution.kind === "recovery" ? resolution : null;
  if (user.emailVerified && !ssoRecoveryResend) {
    // No mail goes out, so nothing is recorded against the account either.
    skipV3AuditLog(auditLog);
    return noContentResponse({ requestId });
  }

  if (auditLog) auditLog.targetId = user.id;
  // Copied while the request is live: Better Auth reads the headers after the response has gone. The
  // per-account budget and the SMTP round trip then run in `after()`, so neither changes the answer.
  const requestHeaders = new Headers(await headers());
  after(() =>
    deliverVerificationEmail({
      user,
      callbackUrl: validatedCallbackUrl,
      ssoRecoveryResend,
      requestHeaders,
    })
  );
  return noContentResponse({ requestId });
}
