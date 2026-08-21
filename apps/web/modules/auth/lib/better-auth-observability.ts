import "server-only";
import { BetterAuthError } from "@better-auth/core/error";
import * as Sentry from "@sentry/nextjs";
import type { BetterAuthOptions } from "better-auth";
import { isAPIError } from "better-auth/api";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { IS_PRODUCTION, SENTRY_DSN } from "@/lib/constants";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { AuthHookContext } from "@/modules/ee/sso/lib/better-auth-hooks";
import { getBetterAuthRequestContext } from "./better-auth-request-context";
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
  // /callback/:id covers both built-in social and, since Better Auth 1.7 (ENG-2343), genericOAuth/SAML
  // too — they share the social-provider route now instead of the old /oauth2/callback/:providerId.
  // This is the INTERNAL endpoint path, which is why it is not the pinned public callback URL: the URL
  // customers register stays /api/auth/oauth2/callback/{providerId}, and legacy-sso-callback.ts maps it
  // onto this route before Better Auth sees it. Do not "restore" /oauth2/ here.
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
 * Better Auth embeds user email addresses in some log messages — `sign-up.mjs` logs
 * `Sign-up attempt for existing email: <address>` on every duplicate sign-up, at `info`. Today
 * `level: "warn"` suppresses that one, so nothing leaks; but the level is exactly what someone would
 * raise while debugging a sign-up problem, and doing so would start writing customer addresses into
 * our logs. Redacting here rather than relying on the level means raising it stays safe. The domain is
 * kept — it is the part that carries diagnostic value. (ENG-2091)
 *
 * Only the logger needs this: since ENG-2037 (below) Sentry receives a real `Error` object or nothing,
 * never a string built from `message`.
 */
/**
 * Local part is a negated class that EXCLUDES `@`, so the run can only end where the `@` actually is —
 * the engine has no ambiguous split to backtrack through. Domain labels likewise exclude `.`. Both are
 * length-bounded (RFC 5321 limits: 64 for the local part, 63 per label), which caps the work per start
 * position regardless of input. An enumerated local-part class that included `.` would be
 * super-linear on a long run with no `@` in it.
 */
const EMAIL_IN_MESSAGE = /[^\s@]{1,64}@([\w-]{1,63}(?:\.[\w-]{1,63}){1,8})/g;

export const redactEmailsInLogMessage = (message: unknown): unknown =>
  typeof message === "string" ? message.replace(EMAIL_IN_MESSAGE, "[redacted]@$1") : message;

/**
 * `StateError` codes whose events are client- or timing-caused, and so are not actionable in Sentry
 * (ENG-2471). `StateError extends BetterAuthError` and carries a stable `code`, which is what we match
 * on — never the message, which is not a contract.
 *
 * Read from the throw sites in `better-auth/dist/state.mjs`, **for the strategy we actually run**. That
 * matters more than it sounds: the file has two branches that throw different codes for the same
 * underlying cause, and reading the wrong one inverts the conclusions. Better Auth picks the strategy
 * from `!!options.database || !!options.secondaryStorage`, and `auth.ts` sets BOTH — so it resolves to
 * `"database"` and the cookie branch never executes here. Noted as both deliberately: dropping Redis
 * alone would not flip it back.
 *
 * | code | thrown when (database strategy) | actionable? |
 * | --- | --- | --- |
 * | `state_mismatch` | no verification record for this `state` — purged after its 10-minute TTL, already consumed, or never issued — or the parsed state is past `expiresAt` | no — **suppressed** |
 * | `state_not_found` | the callback carried no `state` parameter at all | **yes**, kept — see below |
 * | `state_security_mismatch` | the state does not match the stored one, or the signed `state` cookie fails verification ("State not persisted correctly") | **yes**, kept |
 * | `state_generation_error` | the adapter could not write the verification row | **yes**, kept — a real fault |
 * | `state_invalid` | undecryptable state — **cookie branch only, unreachable on this config** | kept; suppressing a code that never fires buys nothing |
 *
 * `state_not_found` was in the first draft of this set and was deliberately taken back out. A real
 * user-initiated flow cannot produce it: the IdP echoes the `state` it was given, so an absent `state`
 * means either a bare scanner hitting the callback path, or something upstream dropping the parameter —
 * an IdP regression, a proxy stripping the query string, or a callback-URL rewrite mishandling it (which
 * is now a live concern: ENG-2343 rewrites every SSO callback through `legacy-sso-callback.ts`). That
 * second class is a total-SSO-outage shape for the affected provider, and this code is the canary for
 * it. Nothing in FORMBRICKS-16G is this code — the reported events are all `verification not found`,
 * i.e. `state_mismatch` — so suppressing it would have traded an unmeasured amount of scanner noise for
 * the loss of that canary, on no evidence. If it does turn out to be dominated by scanners once the
 * `auth.path` tag is live, adding it then is a one-line change backed by data.
 *
 * `state_security_mismatch` carries the load this gate deliberately does not take on, and it is mixed:
 *
 * - The state cookie's `maxAge` is 300s while the verification record lives 10 minutes, so a user who
 *   spends 5–10 minutes at the identity provider loses the cookie first and lands here. Benign, and
 *   probably common — **so this change likely leaves residual noise behind**; it closes the reported
 *   `verification not found` shape (FORMBRICKS-16G), not the whole class.
 * - It is also where a `BETTER_AUTH_SECRET` divergence across replicas surfaces, because the signed
 *   cookie cannot be verified with a different secret. That is a genuine outage and must keep paging.
 * - And it is the shape a forged or mixed-up callback takes.
 *
 * Code cannot separate those three, which is exactly why ENG-2471 defers the decision to the `auth.path`
 * tag from ENG-2259 rather than guessing. Suppressing a signal before measuring it is how ENG-2037 left
 * this shape behind in the first place.
 *
 * One security-visible consequence, stated rather than left implicit: a *replayed* callback — the same
 * `state` presented again after the legitimate flow consumed it — also lands on `state_mismatch`, so
 * replay attempts stop being visible in Sentry. That is judged acceptable because the replay fails
 * closed (the record is single-use, and the authorization code is single-use at the IdP too), so this is
 * a loss of visibility into a *failed* attempt, not of a control. The events remain in the application
 * log with their `stateErrorCode`, which is where a campaign would show up as volume.
 *
 * What suppression costs, stated narrowly: a Redis eviction, flush, or failover to an empty replica
 * drops in-flight verification records and yields `state_mismatch` for real login failures. A *hard*
 * Redis outage does not — `secondary-storage.ts` rethrows on connect failure, which is not a
 * `StateError` and still pages. The suppressed events remain at `error` in the application log carrying
 * `stateErrorCode` and the request's `authPath`, so they are greppable; note there is no log-based alert
 * rule for them today, so a burst is discoverable rather than announced.
 */
const UNACTIONABLE_STATE_ERROR_CODES: ReadonlySet<string> = new Set(["state_mismatch"]);

/**
 * The `StateError` code carried by a logged cause, or undefined when it is not one.
 *
 * Extracted once and used for BOTH the log context and the Sentry gate, so a suppressed event stays
 * queryable by the same value that suppressed it — the log is the only place these survive, and an
 * upstream message string is not something to build an alert on.
 *
 * Deliberately reads only `code`, never the error's `details`, which holds the raw `state` value: that
 * is a single-use credential for the in-flight OAuth flow and has no business in a log line.
 */
const getStateErrorCode = (cause: Error | undefined): string | undefined => {
  if (!(cause instanceof BetterAuthError)) return undefined;
  const { code } = cause as { code?: unknown };
  return typeof code === "string" ? code : undefined;
};

/**
 * Fails CLOSED on purpose: anything not positively identified as an unactionable code is still
 * captured. A wrong answer here should add noise, never silence a genuine fault.
 */
const isUnactionableStateError = (code: string | undefined): boolean =>
  code !== undefined && UNACTIONABLE_STATE_ERROR_CODES.has(code);

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
  // Kept at "warn" so Better Auth's own info/debug chatter stays out of production logs. Raising it is
  // now safe from a PII standpoint — see redactEmailsInLogMessage above.
  level: "warn",
  disableColors: true,
  log: (level, message, ...args) => {
    // Endpoint label for the request being served, or undefined outside the HTTP handler (instance
    // construction, a server-side `auth.api.*` call). Already reduced to a safe label — never a raw
    // path, which on `/reset-password/:token` would be a live credential (better-auth-path-label.ts).
    const request = getBetterAuthRequestContext();
    // BA usually passes the Error as a trailing arg, but a couple of sites pass it as `message`.
    const cause = [...args, message].find((arg): arg is Error => arg instanceof Error);
    const stateErrorCode = getStateErrorCode(cause);
    const contextLogger = logger.withContext({
      source: "better-auth",
      // Self-hosters have no Sentry, so the label has to reach the application log too — otherwise
      // their copy of this fault stays as untriageable as FORMBRICKS-183 was.
      ...(request && { authPath: request.path, httpMethod: request.method }),
      // The suppressed state rejections survive only in the log, so the code has to be queryable there
      // (ENG-2471). Recorded for every state error, not only the suppressed ones.
      ...(stateErrorCode && { stateErrorCode }),
    });
    const safeMessage = redactEmailsInLogMessage(message);
    if (level === "error") {
      contextLogger.error(safeMessage);
      if (SENTRY_DSN && IS_PRODUCTION) {
        // Skip handled rejections: a bare string code (no Error), a client-facing APIError, or a
        // client/timing-caused OAuth `StateError` (ENG-2471). Capture only genuine internal faults so
        // Sentry stays actionable (see the reason-split above and UNACTIONABLE_STATE_ERROR_CODES).
        if (cause && !isAPIError(cause) && !isUnactionableStateError(stateErrorCode)) {
          // ENG-2259: Better Auth's router logs a non-APIError as `(e.name, e)` and discards the
          // endpoint (`better-auth/dist/api/index.mjs:210`), so a bare capture arrives with no
          // transaction, URL or route — which is why FORMBRICKS-183 sat at ~242 events untriageable.
          // Tags don't affect grouping, so the issue stays one issue with `auth.path` as a facet.
          Sentry.captureException(cause, {
            tags: {
              component: "better-auth",
              ...(request && { "auth.path": request.path, "http.method": request.method }),
            },
            // No `extra`. Forwarding `message` was considered and dropped: `redactEmailsInLogMessage`
            // strips emails and nothing else, so a plugin logging `error("… <token> …", err)` would
            // put that token in Sentry verbatim — while the message adds nothing, being either the
            // error's own name or a sentence accompanying the Error already captured here. Keeping
            // Sentry to `Error`-or-nothing is what makes the header note above stay true.
          });
        }
      }
    } else if (level === "warn") {
      contextLogger.warn(safeMessage);
    } else {
      contextLogger.info(safeMessage);
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
