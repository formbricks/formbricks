import { BetterAuthError } from "@better-auth/core/error";
import * as Sentry from "@sentry/nextjs";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  auditFailedAuthAfter,
  auditPasswordReset,
  auditVerificationSessionWithheld,
  betterAuthLogger,
  getSignInAuthMethod,
  recordSsoCallbackOutcome,
  recordSsoCallbackThrow,
  redactEmailsInLogMessage,
  signInAuditDatabaseHook,
} from "./better-auth-observability";
import { runWithBetterAuthRequestContext } from "./better-auth-request-context";
import { finalizeSuccessfulSignIn } from "./sign-in-tracking";
import { logAuthAttempt, shouldLogAuthFailure } from "./utils";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Stable context-logger so the betterAuthLogger tests can assert the local log level.
const contextLoggerMock = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => contextLoggerMock) },
}));

// betterAuthLogger only captures to Sentry when SENTRY_DSN && IS_PRODUCTION; force both on for the file.
vi.mock("@/lib/constants", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/constants")>()),
  IS_PRODUCTION: true,
  SENTRY_DSN: "https://examplePublicKey@o0.ingest.sentry.io/0",
}));

vi.mock("./sign-in-tracking", () => ({
  finalizeSuccessfulSignIn: vi.fn(),
}));

vi.mock("./utils", () => ({
  logAuthAttempt: vi.fn(),
  shouldLogAuthFailure: vi.fn(),
}));

describe("redactEmailsInLogMessage (ENG-2091)", () => {
  test("strips the local part from Better Auth's duplicate-sign-up message, keeping the domain", () => {
    // The real message from better-auth's sign-up.mjs, logged at `info` on every duplicate sign-up.
    expect(
      redactEmailsInLogMessage("Sign-up attempt for existing email: alice.smith+tag@corporate.example.com")
    ).toBe("Sign-up attempt for existing email: [redacted]@corporate.example.com");
  });

  test("redacts every address in a message, not just the first", () => {
    expect(redactEmailsInLogMessage("linking a@x.com to b@y.co.uk")).toBe(
      "linking [redacted]@x.com to [redacted]@y.co.uk"
    );
  });

  // The pattern is bounded and its classes exclude the delimiter they end on, so a long run with no
  // `@` cannot cause super-linear backtracking. Kept as a test so a future "simplification" back to an
  // enumerated local-part class (which would include `.` and reintroduce the ambiguity) shows up here.
  test("stays fast on a long address-free run", () => {
    const started = performance.now();
    expect(redactEmailsInLogMessage(`${"a.b!c#d$e%f&g'".repeat(4000)}!`)).toContain("a.b!c#d");
    expect(performance.now() - started).toBeLessThan(1000);
  });

  test("leaves messages without an address untouched and passes non-strings through", () => {
    expect(redactEmailsInLogMessage("Failed to run background task:")).toBe("Failed to run background task:");
    const err = new Error("boom");
    expect(redactEmailsInLogMessage(err)).toBe(err);
    expect(redactEmailsInLogMessage(undefined)).toBeUndefined();
  });
});

describe("getSignInAuthMethod (signedIn audit allow-list)", () => {
  test.each([
    ["/sign-in/email", "password"],
    ["/verify-email", "password"], // auto-login after email verification (ENG-1746)
    ["/two-factor/verify-totp", "password"],
    ["/two-factor/verify-backup-code", "password"],
    ["/callback/google", "sso"],
    ["/callback/azuread", "sso"],
  ])("audits sign-in completion %s as %s", (path, expected) => {
    expect(getSignInAuthMethod(path)).toBe(expected);
  });

  // Non-sign-in session re-issues must NOT be audited as signedIn (the [MEDIUM] fix).
  test.each([
    "/two-factor/disable",
    "/two-factor/enable",
    "/two-factor/verify-otp", // ambiguous — also the first-time-enable path → not a sign-in
    "/change-password",
    "/sign-in/social", // OAuth initiation, no session created
  ])("does not audit non-sign-in path %s", (path) => {
    expect(getSignInAuthMethod(path)).toBeNull();
  });

  test("does not audit when the path is undefined (context-less session create)", () => {
    expect(getSignInAuthMethod(undefined)).toBeNull();
  });
});

const makeCtx = (overrides: {
  path?: string;
  body?: unknown;
  returned?: unknown;
}): Parameters<typeof auditFailedAuthAfter>[0] =>
  ({
    path: overrides.path,
    body: overrides.body,
    context: { returned: overrides.returned },
  }) as unknown as Parameters<typeof auditFailedAuthAfter>[0];

const unauthorized = (): APIError =>
  new APIError("UNAUTHORIZED", {
    message: "Invalid email or password",
    code: "INVALID_EMAIL_OR_PASSWORD",
  });

describe("auditFailedAuthAfter (failed-login audit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shouldLogAuthFailure).mockResolvedValue(true);
  });

  test("audits a rejected /sign-in/email via the hashed-identifier helper", async () => {
    await auditFailedAuthAfter(
      makeCtx({ path: "/sign-in/email", body: { email: "ada@example.com" }, returned: unauthorized() })
    );

    expect(shouldLogAuthFailure).toHaveBeenCalledWith("ada@example.com");
    // Reason derived from the returned APIError's code; never the raw email (logAuthAttempt hashes it).
    expect(logAuthAttempt).toHaveBeenCalledWith(
      "invalid_email_or_password",
      "credentials",
      "password",
      UNKNOWN_DATA,
      "ada@example.com"
    );
  });

  test("ignores non-sign-in paths (e.g. sign-up)", async () => {
    await auditFailedAuthAfter(
      makeCtx({ path: "/sign-up/email", body: { email: "ada@example.com" }, returned: unauthorized() })
    );

    expect(shouldLogAuthFailure).not.toHaveBeenCalled();
    expect(logAuthAttempt).not.toHaveBeenCalled();
  });

  test("does not audit a successful sign-in (no APIError returned)", async () => {
    await auditFailedAuthAfter(
      makeCtx({
        path: "/sign-in/email",
        body: { email: "ada@example.com" },
        returned: { token: "session-token", user: { id: "user-1" } },
      })
    );

    expect(logAuthAttempt).not.toHaveBeenCalled();
  });

  test("respects the rate-limit gate (fail-closed when Redis is unavailable)", async () => {
    vi.mocked(shouldLogAuthFailure).mockResolvedValue(false);

    await auditFailedAuthAfter(
      makeCtx({ path: "/sign-in/email", body: { email: "ada@example.com" }, returned: unauthorized() })
    );

    expect(logAuthAttempt).not.toHaveBeenCalled();
  });

  test("skips when the request body carries no email", async () => {
    await auditFailedAuthAfter(makeCtx({ path: "/sign-in/email", body: {}, returned: unauthorized() }));

    expect(shouldLogAuthFailure).not.toHaveBeenCalled();
    expect(logAuthAttempt).not.toHaveBeenCalled();
  });

  test("falls back to the HTTP status when the returned APIError carries no code", async () => {
    await auditFailedAuthAfter(
      makeCtx({
        path: "/sign-in/email",
        body: { email: "ada@example.com" },
        returned: new APIError("UNAUTHORIZED", { message: "no code field" }),
      })
    );

    // No `code` on the error body → reason derived from the status, still lower-cased and non-empty.
    const reason = vi.mocked(logAuthAttempt).mock.calls[0][0];
    expect(reason).toEqual(expect.any(String));
    expect(reason).toBe(reason.toLowerCase());
    expect(logAuthAttempt).toHaveBeenCalledWith(
      reason,
      "credentials",
      "password",
      UNKNOWN_DATA,
      "ada@example.com"
    );
  });
});

describe("signInAuditDatabaseHook (signedIn success audit)", () => {
  // Resolve the optional create.after hook once so the arg casts below stay readable.
  const runSessionCreateAfter = signInAuditDatabaseHook.create!.after!;
  type Session = Parameters<typeof runSessionCreateAfter>[0];
  type Context = Parameters<typeof runSessionCreateAfter>[1];
  const session = { userId: "user-1" } as unknown as Session;
  const ctxFor = (path: string): Context => ({ path }) as unknown as Context;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ email: "ada@example.com" } as never);
  });

  test("queues a signedIn audit for a genuine sign-in completion", async () => {
    await runSessionCreateAfter(session, ctxFor("/sign-in/email"));

    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "signedIn",
        targetType: "user",
        userId: "user-1",
        targetId: "user-1",
        status: "success",
        userType: "user",
        newObject: { authMethod: "password", sessionStrategy: "database" },
      })
    );
  });

  test("does not audit or track a session re-issue that is not a sign-in", async () => {
    await runSessionCreateAfter(session, ctxFor("/two-factor/disable"));

    expect(queueAuditEventBackground).not.toHaveBeenCalled();
    expect(finalizeSuccessfulSignIn).not.toHaveBeenCalled();
  });

  test("refreshes lastLoginAt and captures the sign-in event for a genuine sign-in", async () => {
    await runSessionCreateAfter(session, ctxFor("/sign-in/email"));

    expect(finalizeSuccessfulSignIn).toHaveBeenCalledWith({
      userId: "user-1",
      email: "ada@example.com",
      provider: "password",
    });
  });

  test("never throws when sign-in tracking fails", async () => {
    vi.mocked(prisma.user.findUnique).mockRejectedValueOnce(new Error("db down"));

    await expect(runSessionCreateAfter(session, ctxFor("/sign-in/email"))).resolves.toBeUndefined();
    expect(finalizeSuccessfulSignIn).not.toHaveBeenCalled();
  });

  test("skips tracking when the user record is missing", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce(null);

    await runSessionCreateAfter(session, ctxFor("/sign-in/email"));

    expect(finalizeSuccessfulSignIn).not.toHaveBeenCalled();
  });

  test("never throws when the audit queue fails", async () => {
    vi.mocked(queueAuditEventBackground).mockRejectedValueOnce(new Error("redis down"));

    await expect(runSessionCreateAfter(session, ctxFor("/sign-in/email"))).resolves.toBeUndefined();
  });
});

describe("auditPasswordReset (onPasswordReset audit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("queues an updated/user audit carrying the password-reset marker", async () => {
    await auditPasswordReset("user-1");

    expect(queueAuditEventBackground).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "user",
        userId: "user-1",
        targetId: "user-1",
        status: "success",
        userType: "user",
        newObject: { passwordResetMarker: true },
      })
    );
  });

  test("never throws when the audit queue fails", async () => {
    vi.mocked(queueAuditEventBackground).mockRejectedValueOnce(new Error("redis down"));

    await expect(auditPasswordReset("user-1")).resolves.toBeUndefined();
  });
});

describe("auditVerificationSessionWithheld (ENG-2562)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The reason is the payload's reason for existing: `absent` is the ordinary cross-device click or a
  // mail-scanner prefetch, while `other_user` is a valid intent cookie naming a different account. Both
  // reach this event, and without the reason recorded the distinction cannot be recovered afterwards.
  test.each(["absent", "invalid", "other_user", "grant_failed"])(
    "queues an updated/user audit carrying the withheld marker and the reason %s",
    async (reason) => {
      await auditVerificationSessionWithheld("user-1", reason);

      expect(queueAuditEventBackground).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "updated",
          targetType: "user",
          userId: "user-1",
          targetId: "user-1",
          status: "success",
          userType: "user",
          newObject: { verificationSessionWithheldMarker: true, reason },
        })
      );
    }
  );

  // The caller runs inside a verification request that has already flipped `emailVerified`, so a throw
  // out of the audit would 500 a link that verified the user.
  test("never throws when the audit queue fails", async () => {
    vi.mocked(queueAuditEventBackground).mockRejectedValueOnce(new Error("redis down"));

    await expect(auditVerificationSessionWithheld("user-1", "absent")).resolves.toBeUndefined();
  });
});

describe("betterAuthLogger (Sentry capture gating, ENG-2037)", () => {
  // Optional on the BetterAuthOptions["logger"] type, but always defined here.
  const log = betterAuthLogger.log!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Better Auth logs handled OAuth rejections as a bare string code (redirectOnError) — the top Sentry
  // noise source (FORMBRICKS-16Q). These must NOT be captured, only logged locally.
  test.each(["account_not_linked", "unable_to_create_user", "unable_to_get_user_info", "email_not_found"])(
    "does not capture the handled OAuth rejection code %s",
    (code) => {
      log("error", code);

      expect(Sentry.captureException).not.toHaveBeenCalled();
      // The rejection is still visible in the application log.
      expect(contextLoggerMock.error).toHaveBeenCalledWith(code);
    }
  );

  test("does not capture a client-facing APIError (handled 4xx, e.g. FAILED_TO_CREATE_USER)", () => {
    const apiError = new APIError("UNPROCESSABLE_ENTITY", {
      message: "Failed to create user",
      code: "FAILED_TO_CREATE_USER",
    });

    // BA logs this as ("Failed to create user", apiError) on the credential path.
    log("error", "Failed to create user", apiError);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(contextLoggerMock.error).toHaveBeenCalledWith("Failed to create user");
  });

  test("captures a genuine internal fault passed as a trailing arg (DB/adapter error)", () => {
    const dbError = new Error("Better auth was unable to query your database");

    log("error", "Better auth was unable to query your database.\nError: ", dbError);

    // Outside the HTTP handler there is no request context, so the endpoint tags are absent — the
    // capture still happens, which is what keeps `auth.api.*` faults reportable (ENG-2259).
    expect(Sentry.captureException).toHaveBeenCalledWith(dbError, {
      tags: { component: "better-auth" },
    });
  });

  test("captures the deadlock DriverAdapterError so the ENG-2038 signal stays visible", () => {
    // A non-APIError Error must still reach Sentry — this is the signal we watch post-deploy.
    const deadlock = new Error("deadlock detected");

    // Better Auth types `message` as string, but some of its sites pass the Error itself as the
    // message (see betterAuthLogger's cause lookup) — this test exercises exactly that path.
    log("error", deadlock as unknown as string);

    expect(Sentry.captureException).toHaveBeenCalledWith(deadlock, {
      tags: { component: "better-auth" },
    });
  });

  test("warn-level logs are never captured", () => {
    log("warn", "account isn't linked");

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(contextLoggerMock.warn).toHaveBeenCalledWith("account isn't linked");
  });

  test("preserves warn-level errors as structured application-log context", () => {
    const dbError = Object.assign(new Error("Connection terminated due to connection timeout"), {
      code: "P1001",
    });

    log("warn", "OAuth resource seed failed", dbError);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(contextLoggerMock.warn).toHaveBeenCalledWith({ err: dbError }, "OAuth resource seed failed");
  });

  test("info/debug-level logs go to info and are never captured", () => {
    log("info", "some info");

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(contextLoggerMock.info).toHaveBeenCalledWith("some info");
  });
});

/**
 * ENG-2471: `BetterAuthError: State mismatch: verification not found` cleared the ENG-2037 gate and
 * paged — 52 events in 14 days. It is a third shape ENG-2037 never enumerated: not a bare string code,
 * not an `APIError`, but a `StateError extends BetterAuthError` carrying a stable `code`.
 *
 * Mirrors the real shape rather than importing it: `StateError` is internal to
 * `better-auth/dist/state.mjs`, and it extends `BetterAuthError` adding only `code`/`details`/`errorURL`
 * — so a subclass carrying `code` is exactly what the gate sees. The codes below are the five that
 * module throws, read from its throw sites.
 */
class StateErrorLike extends BetterAuthError {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

describe("betterAuthLogger — OAuth state errors (ENG-2471)", () => {
  const log = betterAuthLogger.log!;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Client- or timing-caused: the verification record was purged or already consumed, or the parsed
  // state is past its `expiresAt`. Nothing to act on, so these must not page.
  test.each([
    ["state_mismatch", "State mismatch: verification not found"],
    // Cookie-branch message, kept as a label only: the code is what the gate reads, and this variant
    // is unreachable on our database strategy.
    ["state_mismatch", "State mismatch: auth state cookie not found"],
    ["state_mismatch", "Invalid state: request expired"],
  ])("does not capture the client-caused %s (%s)", (code, message) => {
    const stateError = new StateErrorLike(message, code);

    log("error", message, stateError);

    expect(Sentry.captureException).not.toHaveBeenCalled();
    // Still visible in the application log — suppression is Sentry-only. A burst of these is how a
    // Redis eviction would present, since verification records live in Redis only.
    expect(contextLoggerMock.error).toHaveBeenCalledWith(message);
  });

  /**
   * The other four codes stay captured, and each for its own reason:
   * - `state_generation_error` — the adapter could not write the verification row: a real fault.
   * - `state_security_mismatch` — the state does not match the stored one, OR the signed state cookie
   *   fails verification. That second half is where a cross-replica `BETTER_AUTH_SECRET` divergence
   *   surfaces (a real outage) and also where the benign 5–10 minute cookie-expiry case lands, so it is
   *   mixed and ENG-2471 defers judging it until the ENG-2259 `auth.path` tag has sized the split.
   * - `state_invalid` — cookie-branch only, so unreachable on this configuration. Kept because
   *   suppressing a code that never fires buys nothing.
   * - `state_not_found` — a defensive entry rather than a live one. Verified against 1.7.0 that the
   *   callback route short-circuits a missing `state` before any `StateError` is thrown, and logs it
   *   with the OAuth `error` query param rather than an `Error` — so it reaches neither this gate nor
   *   Sentry, and the assertion below is a contract for a shape the callback route does not currently
   *   produce. Kept captured so that if upstream ever does route it through as a real `StateError`, it
   *   pages instead of being dropped by a stale allow-list.
   */
  test.each([
    ["state_generation_error", "Unable to create verification"],
    ["state_invalid", "State invalid: Failed to decrypt or parse auth state"],
    ["state_security_mismatch", "State mismatch: OAuth state parameter does not match stored state"],
    ["state_not_found", "State not found in OAuth callback"],
  ])("still captures %s", (code, message) => {
    const stateError = new StateErrorLike(message, code);

    log("error", message, stateError);

    expect(Sentry.captureException).toHaveBeenCalledWith(stateError, {
      tags: { component: "better-auth" },
    });
  });

  /**
   * The log field is the whole justification for suppressing anything: a suppressed event survives only
   * in the application log, so it has to be queryable by the same value that suppressed it. Without this
   * test the field can be deleted and the suite stays green — verified, it did.
   *
   * Recorded for captured codes too, so one query covers the class rather than only its quiet half.
   */
  test.each([
    ["state_mismatch", "suppressed"],
    ["state_security_mismatch", "captured"],
  ])("records %s on the log context (%s)", (code) => {
    log("error", "State mismatch", new StateErrorLike("State mismatch", code));

    expect(logger.withContext).toHaveBeenCalledWith({
      source: "better-auth",
      stateErrorCode: code,
    });
  });

  // The raw `state` is a single-use credential for the in-flight flow and lives on the error's
  // `details`. Only the code is ever read, so it cannot reach the log through this path.
  test("never puts the raw state value on the log context", () => {
    const stateError = new StateErrorLike("State mismatch: verification not found", "state_mismatch");
    Object.assign(stateError, { details: { state: "super-secret-state-value" } });

    log("error", "State mismatch: verification not found", stateError);

    // Anchor the negative: an empty `mock.calls` stringifies to "[]", which contains no secret, so
    // without this the assertion would hold even if nothing were ever logged.
    expect(logger.withContext).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(logger.withContext).mock.calls)).not.toContain(
      "super-secret-state-value"
    );
  });

  // The gate fails CLOSED: anything it cannot positively identify as THE one suppressed code
  // (`state_mismatch`) is still captured. A wrong answer should add noise, never silence a fault.
  test("captures a BetterAuthError carrying no code", () => {
    const bare = new BetterAuthError("something upstream broke");

    log("error", "something upstream broke", bare);

    expect(Sentry.captureException).toHaveBeenCalledWith(bare, {
      tags: { component: "better-auth" },
    });
  });

  test("captures a look-alike that is not a BetterAuthError, even with a suppressed code", () => {
    const impostor = Object.assign(new Error("State mismatch: verification not found"), {
      name: "BetterAuthError",
      code: "state_mismatch",
    });

    log("error", "State mismatch: verification not found", impostor);

    expect(Sentry.captureException).toHaveBeenCalledWith(impostor, {
      tags: { component: "better-auth" },
    });
  });
});

/**
 * The contract test for the gate above, and the reason the `StateErrorLike` tests are not enough on
 * their own: they assert against a stand-in we define here, so they would keep passing if the REAL
 * `StateError` stopped satisfying the gate. `StateError` is internal to `better-auth/dist/state.mjs`
 * and cannot be imported, so the only way to bind the real shape is to make Better Auth throw one.
 *
 * This drives a real `betterAuth` instance — configured with `betterAuthLogger` itself, so the whole
 * production path runs — at an OAuth callback carrying a `state` with no verification record. That is
 * exactly the reported failure (`State mismatch: verification not found`, FORMBRICKS-16G). If a future
 * upgrade renames the code, changes the class, or stops routing it through the logger, this fails.
 */
describe("betterAuthLogger — the real Better Auth StateError (ENG-2471 contract)", () => {
  const BASE_URL = "http://localhost:3000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const provokeStateMismatch = async (): Promise<void> => {
    const auth = betterAuth({
      baseURL: BASE_URL,
      secret: "eng-2471-contract-test-secret-0123456789abcdef",
      // memoryAdapter declares its models up front; an empty `verification` table is the point — the
      // state below resolves to no record, which is what throws.
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      logger: betterAuthLogger,
      socialProviders: { google: { clientId: "contract-test", clientSecret: "contract-test" } },
    });

    await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/google?state=no-such-state&code=irrelevant`)
    );
  };

  test("is logged, so this suite is exercising the path at all", async () => {
    await provokeStateMismatch();

    // Anti-vacuity: if Better Auth stopped routing this through our logger, the assertion below would
    // pass for the wrong reason — nothing captured because nothing happened.
    expect(contextLoggerMock.error).toHaveBeenCalled();
  });

  // Pins the exact shape the gate depends on, so an upstream rename fails here loudly instead of
  // quietly restoring the noise. Uses a capturing logger rather than `betterAuthLogger`, because the
  // production logger deliberately forwards only the message to our logger, not the Error.
  test("is a BetterAuthError carrying code state_mismatch", async () => {
    const seen: unknown[] = [];
    const auth = betterAuth({
      baseURL: BASE_URL,
      secret: "eng-2471-contract-test-secret-0123456789abcdef",
      database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
      logger: { level: "error", log: (_level, _message, ...args) => seen.push(...args) },
      socialProviders: { google: { clientId: "contract-test", clientSecret: "contract-test" } },
    });

    await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/google?state=no-such-state&code=irrelevant`)
    );

    const stateError = seen.find((arg): arg is Error & { code?: unknown } => arg instanceof BetterAuthError);
    expect(stateError).toBeDefined();
    expect(stateError?.name).toBe("BetterAuthError");
    expect(stateError?.code).toBe("state_mismatch");
  });

  test("is NOT captured to Sentry", async () => {
    await provokeStateMismatch();

    expect(contextLoggerMock.error).toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

// ENG-2259: Better Auth's router logs a non-APIError as `(e.name, e)` and drops the endpoint, so the
// capture arrived with no transaction, URL or route and FORMBRICKS-183 could not be triaged at all.
// The request context supplies the endpoint; these cases pin that it reaches Sentry AND the local log,
// and that its absence degrades rather than breaking the capture.
describe("betterAuthLogger (request-path tagging, ENG-2259)", () => {
  const log = betterAuthLogger.log!;
  const fault = () => new TypeError("Cannot read properties of null (reading 'id')");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("tags the capture with the endpoint label and method", () => {
    const cause = fault();

    runWithBetterAuthRequestContext({ path: "/oauth2/userinfo", method: "GET" }, () => {
      log("error", "TypeError", cause);
    });

    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { component: "better-auth", "auth.path": "/oauth2/userinfo", "http.method": "GET" },
    });
  });

  test("puts the endpoint in the local log context too, for self-hosters with no Sentry", () => {
    runWithBetterAuthRequestContext({ path: "/sign-in/email", method: "POST" }, () => {
      log("error", "TypeError", fault());
    });

    // `httpMethod`, not `authMethod`: the latter already means the authentication method
    // (password / sso) in this very file's sign-in audit, and overloading it would mix HTTP verbs
    // into a field self-hosters query for auth methods.
    expect(logger.withContext).toHaveBeenCalledWith({
      source: "better-auth",
      authPath: "/sign-in/email",
      httpMethod: "POST",
    });
  });

  test("still captures, untagged, when there is no request context", () => {
    const cause = fault();

    log("error", "TypeError", cause);

    expect(Sentry.captureException).toHaveBeenCalledWith(cause, {
      tags: { component: "better-auth" },
    });
    // An untagged capture is itself diagnostic: it means the throw did not come through auth.handler.
    // Array form, not `"tags.auth.path"`: vitest reads a dotted string as a property PATH, so it would
    // look for `tags` → `auth` → `path`, a nesting that never exists, and pass whether or not the tag
    // is set. The key is flat — `tags["auth.path"]` — and only the array form escapes the dot.
    const [, captureContext] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect(captureContext).not.toHaveProperty(["tags", "auth.path"]);
    expect(logger.withContext).toHaveBeenCalledWith({ source: "better-auth" });
  });

  test("never forwards the Better Auth message to Sentry, only tags", () => {
    // `redactEmailsInLogMessage` strips emails and nothing else, so a message string is not a safe
    // Sentry payload — a plugin logging a token in one would forward it verbatim. The capture stays
    // `Error` + bounded tags, which is what keeps the module header's claim true.
    runWithBetterAuthRequestContext({ path: "/sign-in/email", method: "POST" }, () => {
      log("error", "failure for reset token faketokenfaketokenfaketoken00001", fault());
    });

    const [, captureContext] = vi.mocked(Sentry.captureException).mock.calls[0];
    expect(captureContext).not.toHaveProperty("extra");
    expect(JSON.stringify(captureContext)).not.toContain("faketokenfaketokenfaketoken00001");
  });

  test("does not tag a handled APIError into Sentry — the ENG-2037 gate still wins", () => {
    runWithBetterAuthRequestContext({ path: "/sign-in/email", method: "POST" }, () => {
      log("error", "Invalid email or password", new APIError("UNAUTHORIZED", { message: "nope" }));
    });

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

/**
 * ENG-2551: the SSO callback outcome signal. Its whole purpose is to be alertable, so the tests are
 * about the *field values* an alert would key on, not about the human-readable message.
 *
 * The motivating incident is ENG-2750, where 100% of Cloud Microsoft sign-ins failed for ~18 hours
 * and produced no Sentry event at all — Better Auth logs that failure as a bare message with no
 * `Error`, so the capture gate above never sees anything. Hence a signal keyed on the outcome.
 */
describe("recordSsoCallbackOutcome (ENG-2551)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const redirect = (location: string, status = 302) => new Response(null, { status, headers: { location } });

  /**
   * A completed sign-in, which Better Auth marks by minting the session cookie. Success is asserted
   * through that rather than through the redirect target: `getSsoReturnToUrl` preserves the caller's
   * query string, so a legitimate `callbackURL` can carry `?error=…` of its own.
   */
  const signedInRedirect = (location: string) => {
    const response = new Response(null, { status: 302, headers: { location } });
    response.headers.append("set-cookie", "__Secure-formbricks.session_token=abc; Path=/; HttpOnly");
    return response;
  };

  const contextOf = () => vi.mocked(logger.withContext).mock.calls[0]?.[0];

  test.each([
    ["the Better Auth path", "https://app.test/api/auth/callback/azuread"],
    ["the pinned legacy path", "https://app.test/api/auth/oauth2/callback/azuread"],
    ["a trailing slash", "https://app.test/api/auth/callback/azuread/"],
  ])("records a failed callback on %s", (_label, url) => {
    recordSsoCallbackOutcome(url, redirect("https://app.test/auth/login?error=unable_to_get_user_info"));

    expect(contextOf()).toEqual({
      source: "sso-callback",
      ssoCallbackOutcome: "failure",
      ssoProvider: "azuread",
      ssoCallbackReason: "unable_to_get_user_info",
    });
    expect(contextLoggerMock.warn).toHaveBeenCalledWith("SSO callback failed");
  });

  test("records a successful callback, so the alert can key on a ratio", () => {
    recordSsoCallbackOutcome("https://app.test/api/auth/callback/openid", signedInRedirect("/"));

    expect(contextOf()).toEqual({
      source: "sso-callback",
      ssoCallbackOutcome: "success",
      ssoProvider: "openid",
    });
    expect(contextLoggerMock.info).toHaveBeenCalledWith("SSO callback succeeded");
    expect(contextLoggerMock.warn).not.toHaveBeenCalled();
  });

  /**
   * The two failure shapes that do not redirect, and the reason this reads the response rather than
   * hooking an error path: the SSO licence gate answers 403 and an unhandled fault answers 500.
   * Neither throws where an error hook would see it.
   */
  test.each([
    [403, "http_403"],
    [500, "http_500"],
  ])("treats a %i on the callback as a failure", (status, reason) => {
    recordSsoCallbackOutcome("https://app.test/api/auth/callback/saml", new Response(null, { status }));

    expect(contextOf()).toMatchObject({ ssoCallbackOutcome: "failure", ssoCallbackReason: reason });
  });

  // Cardinality guard: anyone can request `/api/auth/callback/<anything>`, and a log field an
  // outsider can fill with unbounded distinct values is a log field no alert can group on.
  test.each([
    ["an unregistered provider id", "https://app.test/api/auth/callback/not-a-provider"],
    ["a very long segment", `https://app.test/api/auth/callback/${"a".repeat(300)}`],
  ])("buckets %s to unknown", (_label, url) => {
    recordSsoCallbackOutcome(url, redirect("/"));

    expect(contextOf()).toMatchObject({ ssoProvider: "unknown" });
  });

  /**
   * The reason needs the same protection as the provider, and the reason is easy to miss: Better Auth
   * **echoes the inbound `error` query parameter** into its redirect (`callback.mjs`,
   * `if (error) redirectOnError(error, error_description)`). Anyone can get a parseable `state` by
   * starting a sign-in, then call the callback with `&error=<anything>` — so without an allow-list an
   * outsider both inflates this field's cardinality and can forge a specific reason to disguise a
   * real outage. A charset regex would not help: it bounds the shape, not the number of values.
   */
  test.each([
    ["a plausible but unknown code", "totally_made_up_code"],
    ["a forged real-looking code", "state_mismatch_2"],
    ["markup", "%3Cscript%3E+injected"],
  ])("buckets %s to other", (_label, injected) => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/google",
      redirect(`https://app.test/auth/login?error=${injected}`)
    );

    expect(contextOf()).toMatchObject({ ssoCallbackReason: "other" });
  });

  test.each([
    ["Better Auth's own callback code", "unable_to_get_user_info"],
    ["a StateError code", "state_mismatch"],
    ["a code this app emits", "account_not_linked"],
    // What a database outage mid-callback actually produces — verified by stopping Postgres against a
    // live instance. Bucketing this one would hide the clearest infrastructure signal there is.
    ["the code an infrastructure fault produces", "internal_server_error"],
  ])("records %s verbatim", (_label, code) => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/azuread",
      redirect(`https://app.test/auth/login?error=${code}`)
    );

    expect(contextOf()).toMatchObject({ ssoCallbackReason: code });
  });

  /**
   * The worst callback failure is the one that never produces a response at all: the request throws,
   * Next answers 500, nobody signs in. Recording only responses would have left precisely that case
   * invisible to the alert.
   */
  test("records a callback that threw", () => {
    recordSsoCallbackThrow("https://app.test/api/auth/callback/azuread");

    expect(contextOf()).toEqual({
      source: "sso-callback",
      ssoCallbackOutcome: "failure",
      ssoProvider: "azuread",
      ssoCallbackReason: "exception",
    });
    expect(contextLoggerMock.warn).toHaveBeenCalledWith("SSO callback failed");
  });

  test("stays silent when a non-callback endpoint throws", () => {
    recordSsoCallbackThrow("https://app.test/api/auth/sign-in/email");

    expect(logger.withContext).not.toHaveBeenCalled();
  });

  test.each([
    ["a non-callback auth endpoint", "https://app.test/api/auth/sign-in/email"],
    ["the callback list root", "https://app.test/api/auth/callback"],
    ["an unparseable URL", "not-a-url"],
  ])("stays silent for %s", (_label, url) => {
    recordSsoCallbackOutcome(url, redirect("/"));

    expect(logger.withContext).not.toHaveBeenCalled();
  });

  /**
   * A redirect the browser cannot follow is a failed sign-in. Both of these previously corrupted the
   * ratio rather than merely losing detail — a missing `Location` was recorded as a *success*, and a
   * malformed one threw into the outer catch so the callback vanished from both sides of the ratio.
   * The earlier test here asserted only that it did not throw, which is the weaker property and is
   * why the suite stayed green.
   */
  /**
   * `URLSearchParams.get` reads both `?error=` and a bare `?error` back as `""`, so a truthiness
   * check counted an ambiguous error parameter as a clean sign-in. Only a genuinely absent parameter
   * (`null`) is a success — same reasoning as the two cases below: anything the browser cannot
   * usefully follow belongs on the failure side, because success is the half the ratio must trust.
   */
  test.each([
    ["an empty error value", "https://app.test/auth/login?error="],
    ["a valueless error parameter", "https://app.test/auth/login?error"],
  ])("records %s as a failure, not a success", (_label, location) => {
    recordSsoCallbackOutcome("https://app.test/api/auth/callback/azuread", redirect(location));

    expect(contextOf()).toMatchObject({ ssoCallbackOutcome: "failure", ssoCallbackReason: "other" });
  });

  test("still records a redirect with no error parameter as a success", () => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/azuread",
      signedInRedirect("https://app.test/?welcome=1")
    );

    expect(contextOf()).toMatchObject({ ssoCallbackOutcome: "success" });
  });

  /**
   * #9026 review, P1. With `response_mode=form_post` Better Auth turns the POST callback into a 302 to
   * its own GET twin *before* validating state or exchanging the code, and `legacy-sso-callback.ts`
   * preserves that flow deliberately. Recording the hop adds a second outcome per sign-in, and since
   * the hop carries no `error` it lands on the success side — so a form_post flow failing 100% of the
   * time would still read as only 50% failures, under any threshold the alert picks.
   */
  test.each([
    ["the Better Auth twin", "https://app.test/api/auth/callback/azuread?code=abc&state=xyz"],
    ["a relative twin", "/api/auth/callback/azuread?code=abc&state=xyz"],
  ])("says nothing for the form_post hop to %s", (_label, location) => {
    recordSsoCallbackOutcome("https://app.test/api/auth/callback/azuread", redirect(location));

    expect(logger.withContext).not.toHaveBeenCalled();
  });

  test("the GET that follows the hop still records the real outcome", () => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/azuread",
      redirect("https://app.test/auth/login?error=state_mismatch")
    );

    expect(contextOf()).toMatchObject({
      ssoCallbackOutcome: "failure",
      ssoCallbackReason: "state_mismatch",
    });
  });

  /**
   * #9026 review, P2. The success destination is the caller's `callbackURL`, and `getSsoReturnToUrl`
   * keeps its query string — so `/page?error=retry` is a supported target. Reading `error` off the
   * redirect cannot tell that apart from Better Auth's own error redirect, which goes to the caller's
   * `errorCallbackURL` (`/auth/login` for every button here). The session cookie can.
   */
  test("a completed sign-in whose callbackURL carries its own error parameter is a success", () => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/azuread",
      signedInRedirect("https://app.test/some-page?error=retry")
    );

    expect(contextOf()).toMatchObject({ ssoCallbackOutcome: "success" });
    expect(contextLoggerMock.warn).not.toHaveBeenCalled();
  });

  test("a failure redirect to errorCallbackURL is still a failure", () => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/azuread",
      redirect("https://app.test/auth/login?error=account_not_linked")
    );

    expect(contextOf()).toMatchObject({
      ssoCallbackOutcome: "failure",
      ssoCallbackReason: "account_not_linked",
    });
  });

  /**
   * Verify-before-link recovery ends here on purpose: no session, no error, an inbox-verification
   * page. Counting it either way corrupts the ratio, so it is named and excluded from both sides.
   */
  test("recovery, with no session and no error, is neither a success nor a failure", () => {
    recordSsoCallbackOutcome(
      "https://app.test/api/auth/callback/openid",
      redirect("https://app.test/auth/verification-requested")
    );

    expect(contextOf()).toMatchObject({
      ssoCallbackOutcome: "incomplete",
      ssoCallbackReason: "no_session",
    });
    expect(contextLoggerMock.warn).not.toHaveBeenCalled();
    expect(contextLoggerMock.info).toHaveBeenCalledWith("SSO callback did not complete a sign-in");
  });

  test.each([
    ["a redirect with no Location", undefined, "missing_location"],
    ["a malformed Location", "http://[", "malformed_location"],
  ])("records %s as a failure", (_label, location, reason) => {
    expect(() =>
      recordSsoCallbackOutcome(
        "https://app.test/api/auth/callback/azuread",
        new Response(null, { status: 302, ...(location ? { headers: { location } } : {}) })
      )
    ).not.toThrow();

    expect(contextOf()).toMatchObject({ ssoCallbackOutcome: "failure", ssoCallbackReason: reason });
    expect(contextLoggerMock.warn).toHaveBeenCalledWith("SSO callback failed");
  });
});
