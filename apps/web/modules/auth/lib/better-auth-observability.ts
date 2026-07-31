import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { BetterAuthOptions } from "better-auth";
import { isAPIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { finalizeSuccessfulSignIn } from "./sign-in-tracking";
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
  // Auto-login after email verification (autoSignInAfterVerification, ENG-1746) creates a session for
  // a credential/email-password account, so audit it as "password". Idempotent replays of an
  // already-verified token don't create a session, so this fires once, on the genuine first verify.
  if (path === "/verify-email") return "password";
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
 * session re-issues don't produce spurious events. `autoSignIn` is off, so sign-up doesn't create a
 * session; email verification does (autoSignInAfterVerification, ENG-1746) and is allow-listed above.
 * Failures create no session, so they're audited separately by
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

      // Parity with the NextAuth route's per-sign-in finalize (events.signIn → finalizeSuccessfulSignIn):
      // refresh User.lastLoginAt + emit the `user_signed_in` analytics event on every genuine sign-in.
      // The session record carries only userId, so resolve the email that updateUserLastLoginAt needs.
      try {
        const user = await prisma.user.findUnique({
          where: { id: session.userId },
          select: { email: true },
        });
        if (user?.email) {
          await finalizeSuccessfulSignIn({ userId: session.userId, email: user.email, provider: authMethod });
        }
      } catch {
        logger
          .withContext({ source: "better-auth" })
          .error("Failed to record successful sign-in (lastLoginAt / analytics)");
      }
    },
  },
};

/**
 * Route Better Auth's logger to @formbricks/logger and capture GENUINE internal faults to Sentry in
 * production — replaces auth.ts's placeholder logger (and the route's Sentry.captureException on auth
 * failures).
 *
 * Sentry gating (ENG-2037): Better Auth logs many EXPECTED, handled rejections at `error` level, so
 * "capture everything at error" floods Sentry with non-actionable noise. Two shapes dominate:
 *   1. OAuth callback rejections logged as a bare string code (`logger.error("account_not_linked")`,
 *      `"unable_to_create_user"`, `"unable_to_get_user_info"`, … via `redirectOnError`) — no Error
 *      object; these are client-facing redirects, e.g. our blocked-domain / SSO provisioning gate
 *      returning `false`. These were the top volume in Sentry (FORMBRICKS-16Q).
 *   2. Credential-path rejections thrown as a Better Auth `APIError` (`FAILED_TO_CREATE_USER`,
 *      `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL`, invalid-input codes) — a 4xx-equivalent response, not a
 *      server fault.
 * Neither is an actionable error, so we capture ONLY a real `Error` that is NOT an `APIError` (the
 * genuinely-exceptional class: DB/adapter faults, misconfig, unexpected throws — including the
 * `deadlock detected` DriverAdapterError we watch for ENG-2038). Everything still reaches the local
 * logger, so handled rejections remain visible in logs — they just don't page via Sentry.
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
        // Skip handled rejections: a bare string code (no Error) or a client-facing APIError. Capture
        // only genuine internal faults so Sentry stays actionable (see the reason-split above).
        if (cause && !isAPIError(cause)) {
          Sentry.captureException(cause);
        }
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

/**
 * Audit a completed password reset — parity with the retired `completePasswordReset` action audit
 * (`updated`/`user`). Wired into Better Auth's `emailAndPassword.onPasswordReset` callback (auth.ts),
 * which fires once per successful reset with the user. The prior audit's old/new snapshots only
 * captured `{id,email,locale,emailVerified}` — none of which change on a reset — so the meaningful
 * signal is just "this user's password was reset", recorded via the marker.
 */
export const auditPasswordReset = async (userId: string): Promise<void> => {
  try {
    await queueAuditEventBackground({
      action: "updated",
      targetType: "user",
      userId,
      targetId: userId,
      organizationId: UNKNOWN_DATA,
      status: "success",
      userType: "user",
      newObject: { passwordResetMarker: true },
    });
  } catch {
    logger.withContext({ source: "better-auth" }).error("Failed to queue password-reset audit event");
  }
};
