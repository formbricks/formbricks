import * as Sentry from "@sentry/nextjs";
import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  auditFailedAuthAfter,
  auditPasswordReset,
  betterAuthLogger,
  getSignInAuthMethod,
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

  test("info/debug-level logs go to info and are never captured", () => {
    log("info", "some info");

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(contextLoggerMock.info).toHaveBeenCalledWith("some info");
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
