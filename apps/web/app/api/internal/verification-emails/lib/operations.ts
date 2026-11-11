import "server-only";
import { cookies, headers } from "next/headers";
import { logger } from "@formbricks/logger";
import {
  ResourceNotFoundError,
  SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { skipV3AuditLog } from "@/app/api/v3/lib/audit";
import { applyIPRateLimitOrRespond } from "@/app/api/v3/lib/operation-rate-limit";
import { noContentResponse, problemUnprocessableContent } from "@/app/api/v3/lib/response";
import type { TV3AuditLog } from "@/app/api/v3/lib/types";
import { WEBAPP_URL } from "@/lib/constants";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { auth } from "@/modules/auth/lib/auth";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  classifySignupIntent,
  createSignupIntentToken,
} from "@/modules/auth/lib/signup-intent";
import { getUserByEmail } from "@/modules/auth/lib/user";
import { SSO_RECOVERY_COMPLETION_PATH, normalizeRoutePathname } from "@/modules/auth/lib/verification-links";
import { applyRateLimit } from "@/modules/core/rate-limit/helpers";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  type TSsoRecoveryIntent,
  getSsoRecoveryPairedTtlSeconds,
  readSsoRecoveryIntent,
  refreshSsoRecoveryIntent,
} from "@/modules/ee/sso/lib/recovery-intent";
import { sendVerificationEmail } from "@/modules/email";
import type { TVerificationEmailBody } from "../schemas";

type TRequestContext = { requestId: string; instance?: string; auditLog?: TV3AuditLog };

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

type TResendUser = NonNullable<Awaited<ReturnType<typeof getUserByEmail>>>;

/** The SSO recovery branch: the recovery link again, paired with the stored intent. */
const resendSsoRecoveryEmail = async (
  user: TResendUser,
  recovery: Extract<TSsoRecoveryResendResolution, { kind: "recovery" }>,
  validatedCallbackUrl: string | undefined
): Promise<void> => {
  // ENG-2783: the resent link and the refreshed intent get ONE lifetime, computed once here.
  //
  // Both halves are needed to finish recovery, so whichever expires first ends the flow — and if
  // the link is the survivor the user is signed in and then told recovery failed. A resend is
  // where they can come apart: the intent's refresh is capped against its original `createdAt`
  // (the caller is unauthenticated, so the window must not slide forever), while a freshly minted
  // link would otherwise take the full TTL no matter how close that ceiling is. Deriving the
  // number twice would also let a clock tick between the two, so it is derived once and passed to
  // both.
  const pairedTtlSeconds = getSsoRecoveryPairedTtlSeconds(recovery.intent);

  // SSO recovery keeps the app-minted JWT and the recovery magic link (now routed to Better Auth's
  // /sso-recovery/sign-in endpoint via buildVerificationLinks).
  await sendVerificationEmail({
    id: user.id,
    email: user.email,
    locale: user.locale,
    callbackUrl: validatedCallbackUrl,
    purpose: "sso_recovery",
    linkTtlSeconds: pairedTtlSeconds,
  });

  // Best-effort: the mail has gone out, so a failure here costs the pairing, not the resend.
  await refreshSsoRecoveryIntent(recovery.stateId, pairedTtlSeconds);
};

/** The ordinary branch: Better Auth's verification email, and the sign-up intent cookie re-paired with it. */
const resendEmailVerification = async (
  user: TResendUser,
  validatedCallbackUrl: string | undefined
): Promise<void> => {
  // Email verification is Better Auth-native (ENG-1054 decommission): BA mints its own verification
  // token and sends the verify link through the emailVerification.sendVerificationEmail callback in
  // auth.ts. The user is unverified here (the guard above returned for verified users), so BA takes
  // its no-session, enumeration-safe path.
  await auth.api.sendVerificationEmail({
    body: { email: user.email, callbackURL: validatedCallbackUrl },
    headers: await headers(),
  });

  // ENG-2562: re-pair the sign-up intent cookie with the link just minted. The cookie's clock
  // starts at sign-up while every resent link gets a fresh hour, so without this a resend's link
  // outlives the cookie and the sign-up browser itself lands on the withheld path. Strictly a
  // refresh — the browser must already hold a valid cookie naming THIS user — so it extends
  // evidence the browser has, and never arms one that lacks it: an unauthenticated caller must not
  // be able to mint sign-up proof for an arbitrary account by asking for a resend. A browser whose
  // cookie has already expired therefore stays on the withheld path (documented residual).
  // Non-fatal, like the sign-up issuance: the email above has already gone out, so a failure here
  // must cost exactly the auto-sign-in UX, never the resend itself.
  try {
    const cookieStore = await cookies();
    if (classifySignupIntent(cookieStore.get(SIGNUP_INTENT_COOKIE_NAME)?.value, user.id) === "valid") {
      cookieStore.set(
        SIGNUP_INTENT_COOKIE_NAME,
        createSignupIntentToken(user.id),
        SIGNUP_INTENT_COOKIE_OPTIONS
      );
    }
  } catch (error) {
    logger.error({ error, userId: user.id }, "Failed to refresh the sign-up intent cookie on resend");
  }
};

/** A refusal the page explains: `details.reason` (and `detail`) is the stable code it translates. */
const refused = ({ requestId, instance }: TRequestContext, reason: string) =>
  problemUnprocessableContent(requestId, reason, { instance, details: { reason } });

/**
 * `POST /api/internal/verification-emails`: send a new verification email, or an SSO recovery one when the
 * callback is a live recovery for this address (pre-login). Charged to the client's IP, and per account
 * when an email is actually sent. Answers 204 when there is nothing more to say.
 */
export async function resendVerificationEmailOperation({
  body,
  ...context
}: TRequestContext & { body: TVerificationEmailBody }): Promise<Response> {
  const { requestId, instance, auditLog } = context;
  const limited = await applyIPRateLimitOrRespond(rateLimitConfigs.auth.verifyEmail, context);
  if (limited) {
    // Not audited, unlike the action: the IP budget is what bounds this pre-login route's audit rows, and
    // auditing every refusal past it would be unbounded (the limiter logs it instead).
    skipV3AuditLog(auditLog);
    return limited;
  }

  const user = await getUserByEmail(body.email);
  if (!user) {
    // Kept as the server action answered it, message included (ENG-7092 tracks the enumeration it allows).
    return problemUnprocessableContent(requestId, new ResourceNotFoundError("user", body.email).message, {
      instance,
      details: { reason: "user_not_found" },
    });
  }
  const validatedCallbackUrl = getValidatedCallbackUrl(body.callbackUrl, WEBAPP_URL) ?? undefined;
  const resolution = await resolveSsoRecoveryResend({
    callbackUrl: validatedCallbackUrl,
    userEmail: user.email,
  });

  // Said out loud rather than folded into the success below. The intent's ceiling is ~15 minutes, so
  // this is the ordinary outcome for someone who comes back to the page later — and the paired TTL
  // means a resend near the ceiling would post a link that is dead on arrival anyway. Restarting SSO
  // sign-in is the only way out, and nothing else on this page says so.
  if (resolution.kind === "expired") {
    return refused(context, SSO_RECOVERY_LINK_EXPIRED_ERROR_CODE);
  }

  const ssoRecoveryResend = resolution.kind === "recovery" ? resolution : null;
  if (user.emailVerified && !ssoRecoveryResend) {
    return noContentResponse({ requestId });
  }
  // Anyone can ask for this account's email from here. Counted per account, only when an email is sent,
  // and below the recipient cap, so strangers rotating IPs cannot spend the whole cap and leave the
  // user's own sign-in with none.
  try {
    await applyRateLimit(rateLimitConfigs.auth.verifyEmailPerAccount, user.id);
  } catch (error) {
    // Answer quietly, exactly as a sent email does. Only unverified accounts reach this line, so an error
    // here would tell anyone which addresses have one — the same reasoning that makes the callback in
    // auth.ts swallow the same refusal.
    if (error instanceof TooManyRequestsError) {
      return noContentResponse({ requestId });
    }
    throw error;
  }
  if (auditLog) auditLog.targetId = user.id;
  if (ssoRecoveryResend) {
    await resendSsoRecoveryEmail(user, ssoRecoveryResend, validatedCallbackUrl);
  } else {
    await resendEmailVerification(user, validatedCallbackUrl);
  }
  return noContentResponse({ requestId });
}
