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
  // A session created on the verification endpoint belongs to a credential/email-password account, so
  // audit it as "password". Since ENG-2562 the session is minted by `verificationAutoSignInAfterHandler`
  // rather than by `autoSignInAfterVerification` (now off), and only for the browser that signed up —
  // but it still arrives here with this path, so the signedIn trail is unchanged. A withheld
  // verification creates no session and so produces no event here; it is recorded separately by
  // `auditVerificationSessionWithheld`. Idempotent replays of an already-verified token create no
  // session either, so this fires once, on the genuine first verify.
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
 * | `state_not_found` | the callback carried no `state` — **never reaches this gate on 1.7**, see below | kept |
 * | `state_security_mismatch` | the state does not match the stored one, or the signed `state` cookie fails verification ("State not persisted correctly") | **yes**, kept |
 * | `state_generation_error` | the adapter could not write the verification row | **yes**, kept — a real fault |
 * | `state_invalid` | undecryptable state — **cookie branch only, unreachable on this config** | kept; suppressing a code that never fires buys nothing |
 *
 * `state_not_found` is kept out of the set, but on 1.7 that choice is **inert**, and the honest reason
 * is worth recording because an earlier draft of this comment got it wrong in both directions.
 *
 * Verified live against 1.7.0: an OAuth callback with no `state` never produces a `StateError` at all.
 * The callback route short-circuits before `parseGenericState` is reached
 * (`better-auth/dist/api/routes/callback.mjs:72-76`):
 *
 * ```js
 * if (!state) { c.context.logger.error("State not found", error); throw c.redirect(`…error=state_not_found`); }
 * ```
 *
 * That second argument is the OAuth `error` *query parameter*, not an `Error`, so our `cause` lookup
 * finds nothing, the Sentry gate's `cause &&` is already false, and the event is logged without a
 * `stateErrorCode`. It was therefore never captured — this code is not part of the over-capture problem,
 * and the `StateError` carrying it (`state.mjs:90`) is unreachable from this route. Listing it here or
 * omitting it changes nothing today; it stays omitted so that if upstream ever routes it through the
 * logger as a real `StateError`, it pages rather than being silently dropped by a stale allow-list.
 *
 * Worth knowing separately, because it is a gap this PR does not close: that makes an IdP which stops
 * echoing `state` — a provider-wide sign-in outage — produce **no Sentry event whatsoever**, only that
 * log line. Independent of this change, and not fixable from this gate.
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
 * What suppression costs, stated narrowly. Two shapes produce `state_mismatch` for *real* login
 * failures, and this gate hides both from Sentry:
 *
 * 1. **Runtime:** a Redis eviction, flush, or failover to an empty replica drops in-flight verification
 *    records. Arrives as a trickle or a burst, mid-operation.
 * 2. **Deploy-time, and the worse of the two:** replicas that do not share one Redis. The record is
 *    written by the pod that started the flow and looked up by whichever pod serves the callback, and
 *    that lookup is the *first* check in the database branch — before the signed-cookie check. So a
 *    split-Redis deployment fails 100% of SSO sign-ins while the state cookie still verifies perfectly
 *    (the secret is shared even when the store is not), which keeps it off `state_security_mismatch` and
 *    squarely on the code we suppress. It also lands exactly when someone is watching Sentry rather than
 *    the logs.
 *
 * A *hard* Redis outage is not in this class — `secondary-storage.ts` rethrows on connect failure, which
 * is not a `StateError`, so it still pages.
 *
 * The suppressed events stay at `error` in the application log with `stateErrorCode` and the request's
 * `authPath`, so they are greppable — and `stateErrorCode` is load-bearing rather than convenient here,
 * because upstream logs every state error under the same "Failed to parse state" message. What is
 * missing is the alert: there is no log-based rule on that field today, so a burst is discoverable
 * rather than announced, which for shape 2 means a total outage nobody is paged for. Tracked separately;
 * this gate cannot fix it.
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
 * ENG-2562: a verification completed but no session was granted.
 *
 * `reason` is the point of the record, not a detail. This fires on the ordinary cross-device click and on
 * a mail-scanner prefetch (`absent`) as readily as on a genuine pre-hijack (`other_user`), so the event
 * alone means "nobody was signed in", NOT "an attack happened". Only `other_user` — a valid intent cookie
 * naming a different account — is inherently suspicious; `invalid` is worth a look; `grant_failed` is our
 * own fault rather than the caller's.
 *
 * Uses the `updated` + marker idiom of `auditPasswordReset` below rather than a new `ZAuditAction`
 * value: it is the established shape for auth-internal events, and it keeps a shared enum out of a fix
 * that has to land on two release branches as well as main. Audit logging is enterprise-gated, so the
 * caller also logs — a self-hoster must still see this.
 */
export const auditVerificationSessionWithheld = async (userId: string, reason: string): Promise<void> => {
  try {
    await queueAuditEventBackground({
      action: "updated",
      targetType: "user",
      userId,
      targetId: userId,
      organizationId: UNKNOWN_DATA,
      status: "success",
      userType: "user",
      newObject: { verificationSessionWithheldMarker: true, reason },
    });
  } catch {
    logger
      .withContext({ source: "better-auth" })
      .error("Failed to queue withheld-verification-session audit event");
  }
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

/**
 * Providers whose id may appear in an SSO callback outcome record (ENG-2551).
 *
 * An allow-list rather than a sanitising regex, because the provider id comes from the request path
 * and anyone can call `/api/auth/callback/<anything>`. A regex would bound the *shape* of the value
 * but not the number of distinct values, so it would hand a caller unbounded control over a log
 * field's cardinality — the thing that makes a log-based alert unusable. Anything unrecognised
 * buckets to `unknown`.
 *
 * Deliberately not imported from the SSO provider config: this module must not depend on the EE
 * surface, and the list answers a different question anyway ("what may we label") rather than "what
 * is registered on this instance".
 */
const SSO_CALLBACK_PROVIDER_IDS = new Set(["google", "github", "azuread", "openid", "saml"]);

/**
 * Callback failure reasons that may be recorded verbatim (ENG-2551).
 *
 * This has to be an allow-list for the same reason the provider id does, and the reason is easy to
 * miss: Better Auth **echoes the inbound `error` query parameter** into its own redirect
 * (`api/routes/callback.mjs`, `if (error) redirectOnError(error, error_description)`). Any caller can
 * obtain a parseable `state` by starting a sign-in and then request
 * `/api/auth/callback/<id>?state=…&error=<anything>`, so the value that lands here is outside
 * attacker control only if we bound it to a known set. A charset regex would bound the *shape* of the
 * value but not the *number of distinct values*, which is the property an alert needs.
 *
 * Two consequences of that echo, both closed by bucketing to `other`: an outsider cannot inflate the
 * cardinality of this field, and cannot forge a specific reason to make a real outage look like
 * something else.
 *
 * Read from `better-auth/dist/oauth2/errors.mjs` (OAUTH_CALLBACK_ERROR_CODES), the two route-level
 * codes in `api/routes/callback.mjs`, the five `StateError` codes in `state.mjs`, and the codes this
 * app redirects with itself. A code that disappears upstream simply stops occurring; a new one
 * buckets to `other` until it is added, which is the safe direction.
 */
const SSO_CALLBACK_REASONS = new Set([
  // Better Auth OAUTH_CALLBACK_ERROR_CODES
  "account_already_linked_to_different_user",
  "email_does_not_match",
  "email_not_found",
  "email_not_verified",
  "invalid_code",
  "issuer_mismatch",
  "issuer_missing",
  "no_callback_url",
  "no_code",
  "nonce_binding_missing",
  "oauth_provider_not_found",
  "unable_to_get_user_info",
  "unable_to_link_account",
  // Better Auth callback route, and the codes its redirectOnError call sites pass. `internal_server_error`
  // is the important one and was found by smoke-testing rather than by reading the enum: stopping the
  // database mid-callback produces it, so it is the code an infrastructure outage actually arrives as.
  "invalid_callback_request",
  "internal_server_error",
  "invalid_payload",
  "invalid_profile",
  "missing_profile",
  "payload_expired",
  "user_creation_failed",
  // Better Auth StateError codes
  "state_generation_error",
  "state_invalid",
  "state_mismatch",
  "state_not_found",
  "state_security_mismatch",
  // Emitted by this app
  "OAuthAccountNotLinked",
  "account_not_linked",
  "invalid_scope",
  "unable_to_create_user",
]);

/**
 * Record the outcome of an SSO callback, so a total sign-in outage announces itself (ENG-2551).
 *
 * The problem this solves is that every SSO outage so far has had a *novel cause* and an *identical
 * symptom*. ENG-1800 (RFC 9207 `iss`), ENG-2555 (wrong `Account.issuer`), ENG-2750 (placeholder
 * issuer) and the suppressed `state_mismatch` class each needed their own diagnosis, and each ended
 * with the callback redirecting to `?error=…` instead of to the callbackURL. Alerting on causes means
 * adding a rule after every incident; alerting on the outcome covers the next one for free.
 *
 * ENG-2750 is why this exists at all: it failed 100% of Cloud Microsoft sign-ins for ~18 hours and
 * produced **no Sentry event**, because Better Auth logs that failure as a bare message with no
 * `Error` argument, so the capture gate above never has anything to capture. A log line keyed on a
 * stable field is what an alert can actually watch.
 *
 * Emits on success too: the useful alert threshold is a *ratio* ("failures exceed N% of callbacks
 * over 15 minutes"), which survives traffic swings, campaigns and quiet weekends in a way an
 * absolute count does not.
 *
 * Failures log at `warn`, not `error`. A single failed callback is routinely the user's own doing — a
 * stale tab, an expired state, a declined consent — and promoting each one to `error` would degrade
 * the signal this is meant to create. The alert keys on `ssoCallbackOutcome`, so the level is
 * presentation, not meaning.
 *
 * Never throws: observability must not be able to fail a sign-in that otherwise succeeded.
 */
export const recordSsoCallbackOutcome = (requestUrl: string, response: Response): void => {
  emitSsoCallbackRecord(requestUrl, (): { outcome: "success" | "failure"; reason?: string } => {
    // A 4xx/5xx on the callback is a failed sign-in too — this is how the SSO licence gate's 403
    // and any unhandled 500 present, and neither redirects.
    if (response.status >= 400) return { outcome: "failure", reason: `http_${response.status}` };
    if (response.status >= 300) {
      // A redirect the browser cannot follow is a failed sign-in, not a quiet success. Both shapes
      // below would otherwise corrupt the ratio the alert keys on rather than merely lose detail: a
      // missing `Location` counted as success inflates the healthy side, and a malformed one threw
      // into the outer catch, dropping the callback from both sides.
      const location = response.headers.get("location");
      if (!location) return { outcome: "failure", reason: "missing_location" };

      let error: string | null;
      try {
        error = new URL(location, requestUrl).searchParams.get("error");
      } catch {
        return { outcome: "failure", reason: "malformed_location" };
      }

      if (!error) return { outcome: "success" };
      return { outcome: "failure", reason: SSO_CALLBACK_REASONS.has(error) ? error : "other" };
    }
    return { outcome: "success" };
  });
};

/**
 * Record an SSO callback that threw rather than returning a response (ENG-2551).
 *
 * The most severe callback failure there is: the request never produces a redirect, Next answers 500,
 * and the user simply cannot sign in. Recording only responses would have left exactly that case
 * invisible to the alert this signal exists to feed.
 */
export const recordSsoCallbackThrow = (requestUrl: string): void => {
  emitSsoCallbackRecord(requestUrl, () => ({ outcome: "failure", reason: "exception" }));
};

/**
 * Shared emitter: resolves the provider from the path, applies the outcome, logs once. Never throws —
 * observability must not be able to fail a sign-in that otherwise succeeded, nor mask the original
 * error on the throwing path.
 */
const emitSsoCallbackRecord = (
  requestUrl: string,
  resolveOutcome: () => { outcome: "success" | "failure"; reason?: string }
): void => {
  try {
    const path = new URL(requestUrl).pathname;
    // The internal path Better Auth actually serves. `mapLegacySsoCallbackRequest` has already
    // rewritten the pinned `/oauth2/callback/:id` form by the time a response exists, so matching the
    // internal shape covers both.
    const providerSegment = /\/callback\/([^/]+)\/?$/.exec(path)?.[1];
    if (!providerSegment) return;

    const provider = SSO_CALLBACK_PROVIDER_IDS.has(providerSegment.toLowerCase())
      ? providerSegment.toLowerCase()
      : "unknown";
    const { outcome, reason } = resolveOutcome();

    const contextLogger = logger.withContext({
      source: "sso-callback",
      ssoCallbackOutcome: outcome,
      ssoProvider: provider,
      ...(reason ? { ssoCallbackReason: reason } : {}),
    });

    if (outcome === "failure") contextLogger.warn("SSO callback failed");
    else contextLogger.info("SSO callback succeeded");
  } catch {
    // A malformed URL is not worth failing or logging a sign-in over.
  }
};
