import "server-only";
import { getSessionFromCtx } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { logger } from "@formbricks/logger";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { getJustVerifiedUserId } from "./email-verification-request-context";
import { SIGNUP_INTENT_COOKIE_NAME, readSignupIntentUserId } from "./signup-intent";

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

  // Nothing below may throw. Better Auth flips `emailVerified` BEFORE this hook runs, and an uncaught
  // throw here propagates out of `runAfterHooks` as a 500 — on a link that already verified the user.
  // On retry they hit the already-verified early return, which never reaches this hook again, so a
  // single fault would strand them: verified, signed out, and with no route back but finding the login
  // page by hand. Any failure therefore degrades to "no session", never to an error.
  try {
    // Read through Better Auth's own resolver rather than `ctx.context.session`, which this route does
    // not populate — `/verify-email` carries no session middleware, which is why the upstream handler
    // called `getSessionFromCtx` here too.
    // `currentSession &&` is load-bearing, not defensive noise: without it an absent session compares
    // `undefined === undefined` against a missing verified-user id and reports "already signed in",
    // which would silently swallow the case rather than withhold it.
    const currentSession = await getSessionFromCtx(ctx);
    if (currentSession && currentSession.user?.id === verifiedUserId) return;

    const intentUserId = readSignupIntentUserId(ctx.getCookie(SIGNUP_INTENT_COOKIE_NAME));
    if (intentUserId !== verifiedUserId) {
      // No proof this browser started the sign-up. The email is verified either way — that is Better
      // Auth's write and it is correct, the mailbox was proven — but the session is withheld.
      logger.info(
        { userId: verifiedUserId, hadIntentCookie: intentUserId !== null },
        "Withheld the post-verification session: the verifying browser did not start this sign-up"
      );

      return;
    }

    const user = await ctx.context.internalAdapter.findUserById(verifiedUserId);
    if (!user) return;

    // Same shape as the SSO recovery sign-in plugin. Routing through the adapter (rather than writing
    // the row directly) keeps the `session.create.before` database hook in play, so a deactivated user
    // is still refused a session here.
    const session = await ctx.context.internalAdapter.createSession(user.id, false);
    if (!session) return;

    await setSessionCookie(ctx, { session, user });

    // Single use: the cookie has done its job, and leaving it would let a replayed verification link
    // mint a second session for the rest of its hour.
    ctx.setCookie(SIGNUP_INTENT_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  } catch (error) {
    // userId only — never the cookie value or the verification token.
    logger.error({ error, userId: verifiedUserId }, "Post-verification auto-sign-in failed");
  }
};
