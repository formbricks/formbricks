import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { EMAIL_AUTH_ENABLED, WEBAPP_URL } from "@/lib/constants";
import { verifyToken } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import { readSsoRecoveryIntent } from "@/modules/ee/sso/lib/recovery-intent";
import {
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoverySecondFactorRedirectUrl,
  getSsoRecoverySecondFactorUnavailableRedirectUrl,
} from "@/modules/ee/sso/lib/recovery-outcomes";
import {
  SSO_RECOVERY_PROOF_COOKIE_NAME,
  SSO_RECOVERY_PROOF_COOKIE_OPTIONS,
  createSsoRecoveryProof,
  getSsoRecoveryStateIdFromCompletionUrl,
} from "@/modules/ee/sso/lib/recovery-proof";

/** Whether the recovery a token names is still live and belongs to the token's user (ENG-7422). */
const isRecoveryLiveFor = async (stateId: string | undefined, userId: string): Promise<boolean> =>
  (await readSsoRecoveryIntent(stateId))?.userId === userId;

/**
 * Creates the recovery session and sets its cookie. A Link can commit between the caller's intent read
 * and the session write, then sweep the account's sessions before this one existed. So the intent is
 * checked again once the session exists: still live means Link has not spent it yet, and its sweep runs
 * after this session and covers it; gone means the session is taken back.
 */
const signInRecoveringUser = async (
  ctx: Parameters<typeof setSessionCookie>[0],
  userId: string,
  stateId: string | undefined
): Promise<void> => {
  const user = await ctx.context.internalAdapter.findUserById(userId);
  if (!user) {
    throw new Error("User not found");
  }
  const session = await ctx.context.internalAdapter.createSession(user.id, false);
  if (!session) {
    throw new Error("Failed to create recovery session");
  }
  if (!(await isRecoveryLiveFor(stateId, userId))) {
    await ctx.context.internalAdapter.deleteSession(session.token);
    throw new Error("SSO recovery was spent while its session was being created");
  }
  await setSessionCookie(ctx, { session, user });
};

/**
 * SSO-recovery magic-link sign-in (ENG-1054, Phase 7) — the Better Auth replacement for the NextAuth
 * `"token"` CredentialsProvider's `sso_recovery` path. Verifies the `sso_recovery` JWT, establishes a
 * Better Auth session (or, for a verified 2FA account, defers to the login page), then redirects to the
 * recovery completion route (which verifies identity and links the SSO account — already BA-compatible).
 *
 * Deliberately recovery-SCOPED — not BA's general `magicLink` plugin, which would introduce a new
 * passwordless auth method (out of scope for the like-for-like migration). Live: the `[...all]` handler
 * is mounted and the recovery email points here. Also harness-testable via `auth.api.ssoRecoverySignIn`.
 *
 * Opening the link also sets the recovery proof cookie (`recovery-proof.ts`, ENG-7310). Completion
 * requires it, so only the browser that opened the mailed link can finish the recovery.
 *
 * Failures (invalid/expired token, inactive user) are logged and redirected to the recovery failure
 * page; the security-critical outcome — the account link — is audited by `completeSsoRecovery`, and
 * abuse is bounded by the `/sso-recovery/*` rate limit (auth.ts). The link works only while the recovery
 * intent its token names is live and belongs to the token's user (ENG-7422). Link and Cancel both spend
 * that intent, so a link that has done its job, or was cancelled, signs nobody in. Until then it may be
 * opened more than once, because mail scanners fetch it before the person does.
 *
 * The link proves mailbox access only, so it must not stand in for a second factor (ENG-7266). A user
 * with a verified email and 2FA gets no session here: they are sent to the login page with the
 * completion URL as `callbackUrl`, sign in with password + TOTP (or an SSO provider already linked),
 * and recovery completes from there. Where the instance has credential sign-in off, that page cannot
 * ask for the factor at all, so the redirect carries an error code naming the dead end instead. Unverified
 * accounts keep the direct session: completing recovery strips their local factors anyway (ENG-2557),
 * since the mailbox owner may not be who set them.
 */
export const ssoRecoverySignInPlugin = {
  id: "sso-recovery",
  endpoints: {
    ssoRecoverySignIn: createAuthEndpoint(
      "/sso-recovery/sign-in",
      {
        method: "GET",
        query: z.object({
          token: z.string(),
          callbackUrl: z.string().optional(),
        }),
      },
      async (ctx) => {
        const { token, callbackUrl } = ctx.query;

        let destination: string | null = null;
        try {
          const { id, purpose, ssoRecoveryStateId } = await verifyToken(token);
          if (purpose !== "sso_recovery") {
            throw new Error("Token is not an SSO recovery token");
          }
          // isActive is a Formbricks column, not a Better Auth field — check it directly.
          const dbUser = await prisma.user.findUnique({
            where: { id },
            select: { isActive: true, emailVerified: true, twoFactorEnabled: true },
          });
          if (!dbUser || dbUser.isActive === false) {
            throw new Error("User not found or inactive");
          }
          // The link is good only while the recovery it was mailed for is live (ENG-7422). Link and
          // Cancel both spend that recovery, so from then on the link signs nobody in. Read, not
          // consumed: mail scanners open the link before the person does (see `readSsoRecoveryIntent`).
          if (!(await isRecoveryLiveFor(ssoRecoveryStateId, id))) {
            throw new Error("SSO recovery is spent, expired or not this user's");
          }
          // The mailbox is proven here and nowhere else, so this is where the browser that will finish
          // recovery gets its proof (ENG-7310). Set before either branch: the 2FA one completes too,
          // in this same browser, after the login page.
          //
          // Only for the recovery this token was mailed for: the state is read from the unsigned
          // `callbackUrl`, so it must match the one signed into the token, which the live-intent check
          // above has already tied to this user.
          const stateId = getSsoRecoveryStateIdFromCompletionUrl(callbackUrl, WEBAPP_URL);
          if (stateId === ssoRecoveryStateId) {
            ctx.setCookie(
              SSO_RECOVERY_PROOF_COOKIE_NAME,
              createSsoRecoveryProof(id, stateId),
              SSO_RECOVERY_PROOF_COOKIE_OPTIONS
            );
          }

          if (dbUser.emailVerified && dbUser.twoFactorEnabled) {
            // The login page is only a way through when it can ask for the factor. With credential
            // sign-in off it renders no form, and the identity that started recovery is unlinked by
            // definition — so say so instead of looping the user through the provider again.
            logger.info(
              { userId: id, emailAuthEnabled: EMAIL_AUTH_ENABLED },
              "SSO recovery sign-in deferred to login: account has 2FA"
            );
            destination = EMAIL_AUTH_ENABLED
              ? getSsoRecoverySecondFactorRedirectUrl(callbackUrl)
              : getSsoRecoverySecondFactorUnavailableRedirectUrl(callbackUrl);
          } else {
            await signInRecoveringUser(ctx, id, ssoRecoveryStateId);
            destination = getValidatedCallbackUrl(callbackUrl, WEBAPP_URL) ?? WEBAPP_URL;
          }
        } catch (err) {
          logger.error(err, "SSO recovery sign-in failed");
        }

        // Redirect OUTSIDE the try: ctx.redirect throws, which the catch would otherwise swallow.
        throw ctx.redirect(destination ?? getSsoRecoveryFailureRedirectUrl(callbackUrl));
      }
    ),
  },
} satisfies BetterAuthPlugin;
