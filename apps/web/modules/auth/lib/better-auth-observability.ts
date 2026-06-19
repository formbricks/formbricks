import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { BetterAuthOptions } from "better-auth";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";

/**
 * Observability parity for the Better Auth cutover (ENG-1054, Phase 7) — re-expresses the audit + Sentry
 * emission the NextAuth `[...nextauth]` route did (its `events.signIn` audit + `Sentry.captureException`)
 * as Better Auth config, so the security audit trail and error reporting survive the flip. Additive:
 * inert until the Better Auth handler is mounted at cutover.
 */

/** Map a Better Auth endpoint path to the audit `authMethod` (parity with the route's getAuthMethod). */
const getAuthMethodFromPath = (path: string | undefined): string => {
  if (!path) return "unknown";
  if (path.includes("/callback/") || path.includes("/oauth2/callback/")) return "sso";
  // 2FA completes the credentials flow → still "password" (the underlying method), matching NextAuth.
  if (path.includes("/sign-in/email") || path.includes("/two-factor/")) return "password";
  return "unknown";
};

/**
 * Emit the `signedIn` success audit on session creation — parity with the NextAuth route's
 * `events.signIn`. A session row is created for every successful sign-in (password, SSO, 2FA
 * completion); `autoSignIn` is off so sign-up/verification don't create one (no spurious events).
 * Failures don't create a session — failed-login auditing is a follow-up (needs response inspection).
 */
export const signInAuditDatabaseHook: NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
> = {
  create: {
    after: async (session, context) => {
      try {
        await queueAuditEventBackground({
          action: "signedIn",
          targetType: "user",
          userId: session.userId,
          targetId: session.userId,
          organizationId: UNKNOWN_DATA,
          status: "success",
          userType: "user",
          newObject: {
            authMethod: getAuthMethodFromPath(context?.path),
            sessionStrategy: "database",
          },
        });
      } catch {
        // Auditing must never block a sign-in (parity with the route's try/catch around emission).
        logger.withContext({ source: "better-auth" }).error("Failed to queue signedIn audit event");
      }
    },
  },
};

/**
 * Route Better Auth's logger to @formbricks/logger and capture errors to Sentry in production —
 * replaces auth.ts's placeholder logger (and the route's Sentry.captureException on auth failures).
 */
export const betterAuthLogger: NonNullable<BetterAuthOptions["logger"]> = {
  level: "warn",
  disableColors: true,
  log: (level, message, ...args) => {
    const contextLogger = logger.withContext({ source: "better-auth" });
    if (level === "error") {
      contextLogger.error(message);
      if (SENTRY_DSN && IS_PRODUCTION) {
        const cause = args.find((arg): arg is Error => arg instanceof Error);
        Sentry.captureException(cause ?? new Error(`[better-auth] ${message}`));
      }
    } else if (level === "warn") {
      contextLogger.warn(message);
    } else {
      contextLogger.info(message);
    }
  },
};
