import "server-only";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { verifyToken } from "@/lib/jwt";
import { getValidatedCallbackUrl } from "@/lib/utils/url";
import {
  getSsoRecoveryFailureRedirectUrl,
  getSsoRecoverySignInRedirectUrl,
} from "@/modules/ee/sso/lib/sso-recovery";

/**
 * SSO-recovery magic-link sign-in (ENG-1054, Phase 7) — the Better Auth replacement for the NextAuth
 * `"token"` CredentialsProvider's `sso_recovery` path. Verifies the `sso_recovery` JWT, establishes a
 * Better Auth session, then redirects to the recovery completion route (which verifies identity and
 * links the SSO account — already BA-compatible).
 *
 * Deliberately recovery-SCOPED — not BA's general `magicLink` plugin, which would introduce a new
 * passwordless auth method (out of scope for the like-for-like migration). Live: the `[...all]` handler
 * is mounted and the recovery email points here. Also harness-testable via `auth.api.ssoRecoverySignIn`.
 *
 * The link proves the mailbox, not a second factor. For a verified account with 2FA it therefore mints
 * NO session and sends the user to the login page with the completion URL as `callbackUrl` (ENG-7266):
 * a password + TOTP sign-in lands on the completion route, which accepts it because the session user
 * matches the intent. An unverified account still gets the session — completion strips its local
 * factors anyway (ENG-2557), so there is no second factor left to protect.
 *
 * Failures (invalid/expired token, inactive user) are logged and redirected to the recovery failure
 * page; the security-critical outcome — the account link — is audited by `completeSsoRecovery`, and
 * abuse is bounded by the `/sso-recovery/*` rate limit (auth.ts). The token is replayable until its
 * 1-day expiry, matching the legacy `"token"` provider (not single-use).
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
          const { id, purpose } = await verifyToken(token);
          if (purpose !== "sso_recovery") {
            throw new Error("Token is not an SSO recovery token");
          }
          // isActive, emailVerified and twoFactorEnabled are Formbricks columns, not Better Auth fields.
          const dbUser = await prisma.user.findUnique({
            where: { id },
            select: { isActive: true, emailVerified: true, twoFactorEnabled: true },
          });
          if (!dbUser || dbUser.isActive === false) {
            throw new Error("User not found or inactive");
          }
          if (dbUser.emailVerified && dbUser.twoFactorEnabled) {
            logger.info({ userId: id }, "SSO recovery link needs a normal sign-in: account has 2FA");
            destination = getSsoRecoverySignInRedirectUrl(callbackUrl);
          } else {
            const user = await ctx.context.internalAdapter.findUserById(id);
            if (!user) {
              throw new Error("User not found");
            }
            const session = await ctx.context.internalAdapter.createSession(user.id, false);
            if (!session) {
              throw new Error("Failed to create recovery session");
            }
            await setSessionCookie(ctx, { session, user });
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
