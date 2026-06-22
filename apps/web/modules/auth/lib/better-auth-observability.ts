import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { BetterAuthOptions } from "better-auth";
import { isAPIError } from "better-auth/api";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { logAuthAttempt, shouldLogAuthFailure } from "./utils";

/**
 * Observability parity for the Better Auth cutover (ENG-1054) — re-expresses the audit + Sentry
 * emission the NextAuth `[...nextauth]` route did (its `events.signIn` audit + `Sentry.captureException`)
 * as Better Auth config, so the security audit trail and error reporting survive the flip. The
 * success-path `signedIn` audit below is LIVE now that the handler is mounted; the failure-path audit
 * is `auditFailedAuthAfter` (wired into `hooks.after`).
 *
 * Mechanism note: a wrong-password sign-in is a HANDLED failure — Better Auth converts it to an
 * `APIError` *response* (surfaced on `ctx.context.returned`), not an unexpected throw — so it does NOT
 * reach `onAPIError.onError` (that fires only for unexpected/internal errors). The failure audit
 * therefore lives in `hooks.after`, where both the request and the returned error are available.
 */

/**
 * Map a Better Auth endpoint path to the audit `authMethod`, or `null` when the path is NOT a sign-in
 * completion. `session.create.after` fires for EVERY session creation — including non-sign-in re-issues
 * (`/two-factor/disable`, first-time 2FA enable, `/change-password` with revokeOtherSessions) — so we
 * allow-list the genuine sign-in entry points and skip the rest, matching NextAuth's `events.signIn`
 * (sign-in only). This allow-list MUST grow if a new session-creating sign-in plugin is enabled
 * (magic-link, passkey, email-otp, one-time-token), otherwise those sign-ins won't be audited.
 */
export const getSignInAuthMethod = (path: string | undefined): string | null => {
  if (!path) return null;
  // /callback/:id (social) and /oauth2/callback/:providerId (generic OAuth/SAML) both contain /callback/
  if (path.includes("/callback/")) return "sso";
  if (path === "/sign-in/email") return "password";
  // The 2FA challenge completes the credentials sign-in → "password" (matches NextAuth). Deliberately
  // NOT /two-factor/verify-otp (also the first-time-enable path) nor /two-factor/disable|enable.
  if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") return "password";
  // The SSO-recovery magic-link sign-in also creates a session (verify-before-link), so audit it as
  // "sso" — the unified signedIn trail should capture every session creation.
  if (path === "/sso-recovery/sign-in") return "sso";
  return null;
};

/**
 * Emit the `signedIn` success audit on session creation — parity with the NextAuth route's
 * `events.signIn`. Guarded to genuine sign-in completions (see getSignInAuthMethod) so non-sign-in
 * session re-issues don't produce spurious events. `autoSignIn` is off, so sign-up/verification don't
 * create a session either. Failures create no session, so they're audited separately by
 * `auditFailedAuthAfter` below (which inspects the returned error in `hooks.after`).
 */
export const signInAuditDatabaseHook: NonNullable<
  NonNullable<BetterAuthOptions["databaseHooks"]>["session"]
> = {
  create: {
    after: async (session, context) => {
      const authMethod = getSignInAuthMethod(context?.path);
      if (!authMethod) return; // session re-issue that isn't a sign-in → no spurious signedIn audit
      try {
        await queueAuditEventBackground({
          action: "signedIn",
          targetType: "user",
          userId: session.userId,
          targetId: session.userId,
          organizationId: UNKNOWN_DATA,
          status: "success",
          userType: "user",
          newObject: { authMethod, sessionStrategy: "database" },
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
 * Normal auth failures (wrong password) log at `warn`, so only genuine internal errors reach Sentry.
 */
export const betterAuthLogger: NonNullable<BetterAuthOptions["logger"]> = {
  level: "warn",
  disableColors: true,
  log: (level, message, ...args) => {
    const contextLogger = logger.withContext({ source: "better-auth" });
    if (level === "error") {
      contextLogger.error(message);
      if (SENTRY_DSN && IS_PRODUCTION) {
        // BA usually passes the Error as a trailing arg, but a couple of sites pass it as `message`.
        const cause = [...args, message].find((arg): arg is Error => arg instanceof Error);
        Sentry.captureException(cause ?? new Error(`[better-auth] ${String(message)}`));
      }
    } else if (level === "warn") {
      contextLogger.warn(message);
    } else {
      contextLogger.info(message);
    }
  },
};

/**
 * Failed-login audit (parity with NextAuth's credentials `authorize` → `logAuthAttempt`), emitted from
 * `hooks.after` because a rejected sign-in is a handled `APIError` *response*, not a thrown error (see
 * the header note — it never reaches `onAPIError.onError`). Reusing `logAuthAttempt` +
 * `shouldLogAuthFailure` preserves full parity: the email is hashed (never stored raw), brute-force
 * attempts are rate-limited (fail-closed when Redis is down), and the failure is mirrored to Sentry in
 * production.
 *
 * Scope: the credential password sign-in (`/sign-in/email`). A failed 2FA challenge
 * (`/two-factor/verify-*`) identifies the user via the two-factor cookie rather than the request body,
 * so it is tracked separately; SSO sign-in failures are redirects (not `APIError`s) and never reach
 * this branch. Composed with `ssoRecoveryAfter` at the single `hooks.after` slot in auth.ts.
 */
export const auditFailedAuthAfter = async (ctx: AuthHookContext): Promise<void> => {
  if (ctx.path !== "/sign-in/email") return;

  // A created session (success) is audited by signInAuditDatabaseHook; only a returned APIError here
  // represents a rejected attempt.
  const returned = (ctx.context as { returned?: unknown }).returned;
  if (!isAPIError(returned)) return;

  const body = ctx.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email : undefined;
  if (!email) return;

  // Throttle audit volume under brute force (fail-closed on Redis outage), matching the NextAuth path.
  if (!(await shouldLogAuthFailure(email))) return;

  const code = (returned.body as { code?: unknown } | undefined)?.code;
  const failureReason = (typeof code === "string" ? code : String(returned.status)).toLowerCase();
  logAuthAttempt(failureReason, "credentials", "password", UNKNOWN_DATA, email);
};
