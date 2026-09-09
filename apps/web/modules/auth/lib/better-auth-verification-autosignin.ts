import "server-only";
import { getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { auditVerificationSessionWithheld } from "./better-auth-observability";
import { getJustVerifiedUserId } from "./email-verification-request-context";
import {
  SIGNUP_INTENT_COOKIE_NAME,
  SIGNUP_INTENT_COOKIE_OPTIONS,
  type TWithheldReason,
  classifySignupIntent,
} from "./signup-intent";

/**
 * Where a verification lands when no session is granted.
 *
 * Without this the request would follow its `callbackURL` — `/` for every sign-up link — and the user
 * would be silently bounced to the login page by middleware, having just been told their email was
 * verified. `?verified=1` is what lets the login form say "verified, now sign in" instead.
 */
const getVerifiedButSignInRequiredUrl = (): string =>
  new URL("/auth/login?verified=1", WEBAPP_URL).toString();

/**
 * Mint the post-verification session for the browser that signed up, and spend the intent cookie.
 *
 * Split out of the handler to keep that function's branching readable; it returns whether a session was
 * actually granted, so the caller decides where to send the user without re-deriving it.
 */
const grantSessionToSignupBrowser = async (
  ctx: AuthHookContext,
  verifiedUserId: string
): Promise<boolean> => {
  // Same shape as the SSO recovery sign-in plugin. Routing through the adapter rather than writing the
  // row directly keeps the `session.create.before` database hook in play, so a deactivated user is still
  // refused a session here — and the caller then withholds rather than letting them in.
  const user = await ctx.context.internalAdapter.findUserById(verifiedUserId);
  const session = user ? await ctx.context.internalAdapter.createSession(user.id, false) : null;
  if (!user || !session) return false;

  await setSessionCookie(ctx, { session, user });

  // Single use: the cookie has done its job. Replay is independently blocked (an already-verified link
  // never fires afterEmailVerification, so the marker is absent), making this defence in depth — but it
  // must actually land: the production name carries the `__Secure-` prefix, and a browser REJECTS any
  // Set-Cookie for such a name without the `Secure` attribute, so clearing with a bare `{ maxAge: 0 }`
  // would silently no-op on HTTPS. Full attribute set, zero lifetime.
  ctx.setCookie(SIGNUP_INTENT_COOKIE_NAME, "", { ...SIGNUP_INTENT_COOKIE_OPTIONS, maxAge: 0 });

  return true;
};

/**
 * ENG-2562 — hand the post-verification session only to the browser that signed up.
 *
 * `emailVerification.autoSignInAfterVerification` used to be `true`, on the reasoning that "clicking
 * the signed link proves email ownership". It does — but it does not prove the clicker chose the
 * account's password, and those are different facts. An attacker could register an address that had no
 * account yet, with a password of their choosing; Formbricks mailed the victim a verification link; and
 * the victim's click signed the VICTIM into an account whose password the ATTACKER still held, in an
 * organization the attacker had provisioned (`handlePostUserCreation` runs at sign-up time). That is
 * textbook account pre-hijacking.
 *
 * The flag is now `false`, so Better Auth mints nothing and this hook is the only thing that can. It
 * mints only when the request carries a sign-up intent cookie naming the user who was just verified —
 * i.e. only when the browser completing the verification is the browser that started the sign-up.
 * Everything else gets a verified email and no session, and is sent to the login page.
 *
 * Deliberately non-destructive: the stored password is never touched. A verifying stranger cannot enter
 * the account, and the legitimate owner recovers through the ordinary reset flow, which rotates the
 * password and revokes sessions (`revokeSessionsOnPasswordReset`). The accepted residual is that the
 * attacker's password survives, so they can sign in until the victim resets — this removes the
 * data-comingling harm, not the squatted account.
 *
 * Notable non-obvious cases:
 *
 * - **A mail scanner prefetching the link** lands on the withheld path, which is exactly why the
 *   non-destructive shape was chosen: it costs a session, not somebody's password.
 * - **Sign-ups through Better Auth's native `/sign-up/email`** never get an intent cookie, so their
 *   verification withholds the session too. Fail-closed, and a deliberate behaviour change.
 * - **`EMAIL_VERIFICATION_DISABLED=1`** (the shipped self-host default) lets a user sign in before
 *   verifying, so a verification can arrive on an already-authenticated request. Better Auth used to
 *   reuse that session; we must not sign such a user out, which is what the early return covers.
 */
export const verificationAutoSignInAfterHandler = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== "/verify-email") return;

  // Set by the composed `afterEmailVerification` hook. Absent unless THIS request verified someone —
  // which is the only trustworthy form of that question, because a successful verification carrying a
  // callbackURL finishes as a thrown redirect and is therefore an `APIError`, exactly like a failure.
  const verifiedUserId = getJustVerifiedUserId();
  if (!verifiedUserId) return;

  // Whether the request finishes without a session, and therefore has to be sent somewhere that says
  // so. Set inside the try; acted on OUTSIDE it, because `ctx.redirect` throws and this catch would
  // otherwise swallow the redirect — the same trap `better-auth-recovery-signin.ts` documents.
  let sessionWithheld = false;

  // Nothing below may throw. Better Auth flips `emailVerified` BEFORE this hook runs, and an uncaught
  // throw here propagates out of `runAfterHooks` as a 500 — on a link that already verified the user.
  // On retry they hit the already-verified early return, which never reaches this hook again, so a
  // single fault would strand them: verified, signed out, and with no route back but finding the login
  // page by hand. Any failure therefore degrades to "no session", never to an error.
  try {
    // Whether the ENDPOINT already attached a session cookie, meaning it made its own sign-in decision
    // and this hook must not second-guess it. Unreachable in today's config — the only `/verify-email`
    // branch that does this is Better Auth's `updateTo` email-change flow and `user.changeEmail` is not
    // enabled — but that branch also fires `afterEmailVerification`, so the guard keeps the hook correct
    // if it is ever enabled. Server-controlled header, not spoofable.
    //
    // Read before `getSessionFromCtx` as belt-and-braces, NOT because a live bug needs it. That helper
    // appends any Set-Cookie the session read produced — `getSession` re-issues the cookie once
    // `updateAge` elapses — but it appends to better-call's `ctx.responseHeaders`, which is a DIFFERENT
    // Headers instance from Better Auth's `ctx.context.responseHeaders` read here (verified at runtime
    // in this hook: `ctx.responseHeaders !== ctx.context.responseHeaders`; the two are merged only after
    // the hook returns, by `mergeResponseHeaders` in dispatch.mjs). So a session refresh cannot reach
    // this value either way. The ordering is kept so the guard's meaning stays unambiguous — it asks
    // what the ENDPOINT returned, and nothing else.
    const sessionCookieName = ctx.context.authCookies?.sessionToken?.name;
    const setCookieBeforeSessionRead = ctx.context.responseHeaders?.get("set-cookie") ?? "";
    const endpointAlreadyGrantedSession = Boolean(
      sessionCookieName && setCookieBeforeSessionRead.includes(`${sessionCookieName}=`)
    );

    // Read through Better Auth's own resolver rather than `ctx.context.session`, which this route does
    // not populate — `/verify-email` carries no session middleware, which is why the upstream handler
    // calls `getSessionFromCtx` here too. `currentSession &&` is load-bearing rather than defensive
    // noise: without it an absent session compares `undefined === undefined` against a missing
    // verified-user id and reports "already signed in", swallowing the case instead of withholding it.
    const currentSession = await getSessionFromCtx(ctx);
    if (currentSession && currentSession.user?.id === verifiedUserId) return;
    if (endpointAlreadyGrantedSession) return;

    const intent = classifySignupIntent(ctx.getCookie(SIGNUP_INTENT_COOKIE_NAME), verifiedUserId);

    // `withheldReason` doubles as the decision: non-null means no session. Carrying the REASON rather
    // than a boolean is what makes this diagnosable — this branch is reached by the ordinary
    // cross-device click and by a mail-scanner prefetch (`absent`) just as much as by a genuine
    // pre-hijack (`other_user`), and only the latter is worth anyone's attention. Logged AND audited
    // because the audit trail is enterprise-gated, so the log line is what a self-hoster gets; both
    // carry the user id and the reason only, never the cookie value or the verification token.
    let withheldReason: TWithheldReason | null = intent === "valid" ? null : intent;

    if (intent === "valid" && !(await grantSessionToSignupBrowser(ctx, verifiedUserId))) {
      // The proof was good but the mint failed — a missing user row or a refused session (the
      // `session.create.before` inactive-user gate lands here). Recorded like any other withheld
      // outcome: without this the one path that is our own fault would be the only silent one.
      withheldReason = "grant_failed";
    }

    if (withheldReason) {
      logger.info(
        { userId: verifiedUserId, reason: withheldReason },
        "Withheld the post-verification session"
      );
      await auditVerificationSessionWithheld(verifiedUserId, withheldReason);
      sessionWithheld = true;
    }
  } catch (error) {
    // userId only — never the cookie value or the verification token.
    logger.error({ error, userId: verifiedUserId }, "Post-verification auto-sign-in failed");
    sessionWithheld = true;
  }

  // Outside the try on purpose: `ctx.redirect` throws, so putting it inside would feed the redirect
  // straight into the catch above and land the user on `callbackURL` with no explanation of why they
  // are not signed in.
  if (sessionWithheld) {
    throw ctx.redirect(getVerifiedButSignInRequiredUrl());
  }
};
