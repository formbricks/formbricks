import "server-only";
import { logger } from "@formbricks/logger";
import { loggableError } from "@/lib/utils/loggable-error";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { type TAuditAction, type TAuditStatus, UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import type { TSsoIdentityProvider } from "./provider-normalization";

/**
 * Audit events for an SSO sign-up, emitted from `ssoDatabaseHooks.user.create.after`. That hook runs
 * post-commit on the sign-in path, so every helper here is best-effort: observability must never be the
 * reason a sign-up fails, and a broken logger or audit sink is swallowed rather than propagated.
 */

/**
 * Queue an audit event about the user an SSO sign-up just created, acting as that user.
 *
 * Not awaited: the helper does its work inside `setImmediate`, so there is nothing to wait for. The
 * rejection handler is defence in depth rather than a live hazard — today that helper cannot reject,
 * because its body is entirely inside the `setImmediate` callback — but an unawaited promise that ever
 * did would take the process down rather than fail this one sign-up.
 */
const queueSsoUserAuditEvent = ({
  userId,
  organizationId,
  action,
  status,
  newObject,
  failureMessage,
}: {
  userId: string;
  /** Null when the sign-up provisioned no organization; recorded as UNKNOWN_DATA, per the audit schema. */
  organizationId: string | null;
  action: TAuditAction;
  status: TAuditStatus;
  newObject: Record<string, unknown>;
  failureMessage: string;
}): void => {
  // `Promise.try` turns a synchronous throw into a rejection too, so the one `.catch` covers both.
  void Promise.try(() =>
    queueAuditEventBackground({
      action,
      targetType: "user",
      userId,
      userType: "user",
      targetId: userId,
      organizationId: organizationId ?? UNKNOWN_DATA,
      status,
      newObject,
    })
  ).catch((error: unknown) => {
    logger.warn({ ...loggableError(error), userId }, failureMessage);
  });
};

/**
 * The `created` / `user` audit event for an SSO sign-up (ENG-2347). An SSO account is created by the
 * Better Auth database hooks, never by the sign-up route (`POST /api/internal/signups`) that records this
 * event for a credential account, so without it an audit log's account history missed every SSO
 * account. Emitted from the SSO after-hook rather than a generic `user.create.after`: the credential
 * path already records the event itself — after its own provisioning, with that outcome as the status —
 * and a generic hook would record those accounts twice.
 *
 * The actor is the new user: the IdP has just authenticated them, unlike a credential sign-up, whose
 * caller has no session and is recorded as unknown. `status` follows the credential path's rule: the
 * account exists either way, and a failed provisioning leaves it without its organization.
 */
export const recordSsoUserCreated = ({
  user,
  organizationId,
  provisioningFailed,
}: {
  /** The row Better Auth inserted. `redactPII` masks its email and name before the event is written. */
  user: { id: string } & Record<string, unknown>;
  organizationId: string | null;
  provisioningFailed: boolean;
}): void => {
  queueSsoUserAuditEvent({
    userId: user.id,
    organizationId,
    action: "created",
    status: provisioningFailed ? "failure" : "success",
    newObject: user,
    failureMessage: "Failed to audit an SSO sign-up",
  });
};

/**
 * Record that an SSO sign-up produced an account whose address the IdP did not vouch for (ENG-2589).
 *
 * Dual emission, matching how SSO recovery reports itself: the audit event is the security trail, and
 * the log line is what a self-hoster actually sees, since audit logging is an enterprise feature and
 * `AUDIT_LOG_ENABLED` is off by default. Neither is a duplicate of the other.
 *
 * `warn`, not `info`: production runs at `warn`, and an unverified account is precisely the state
 * worth noticing — the squatting scenario this fix exists for shows up here, one line per occurrence,
 * as does an IdP that has quietly started denying every address. The fields are stable and low
 * cardinality (the provider comes from a closed five-value enum, so unlike the callback-outcome logger
 * there is nothing to allow-list), and none of them is redacted away: the address itself is
 * deliberately absent, `userId` carries the identity for anyone who needs to follow it up.
 *
 * The verified case is deliberately silent — it is the overwhelming majority and already leaves a
 * `user_signed_up` trail — and the whole thing is best-effort: observability must never be the reason
 * a sign-up fails, so a broken logger or audit sink is swallowed rather than propagated into Better
 * Auth's post-commit hook.
 */
export const recordUnverifiedSsoSignup = ({
  userId,
  organizationId,
  provider,
}: {
  userId: string;
  /** Null when the sign-up provisioned no organization; recorded as UNKNOWN_DATA, per the audit schema. */
  organizationId: string | null;
  provider: TSsoIdentityProvider;
}): void => {
  try {
    logger
      // `userId` is on the log line, not only the audit event: the log is the channel a self-hoster
      // actually has, and "some account was created unverified" with no way to find which one is not
      // an actionable signal. The address itself stays out — the id is enough to look it up.
      .withContext({ source: "sso-signup", ssoProvider: provider, userId, emailVerified: false })
      .warn("SSO sign-up created an account the identity provider did not report as verified");

    queueSsoUserAuditEvent({
      userId,
      organizationId,
      // `updated` + a marker key, not `created`: this records a PROPERTY of a user creation, and it is
      // emitted only for the unverified subset. The creation itself is recorded as `created` / `user`
      // for every SSO sign-up (`recordSsoUserCreated`), so a second `created` here would count the
      // accounts an IdP declined to vouch for twice. The marker idiom is the house convention for
      // auth-internal events (`passwordResetMarker`, `verificationSessionWithheldMarker`).
      action: "updated",
      status: "success",
      // A marker key rather than a new `ZAuditAction` value: this is a property of the user creation
      // already being recorded, not a flow of its own, and it keeps the shared enum untouched. Every
      // key here survives `redactPII` — an `email` would not, which is the other reason it is absent.
      newObject: { ssoUnverifiedSignupMarker: true, provider, emailVerified: false },
      failureMessage: "Failed to audit an unverified SSO sign-up",
    });
  } catch (error) {
    logger.warn(loggableError(error), "Failed to record an unverified SSO sign-up");
  }
};
