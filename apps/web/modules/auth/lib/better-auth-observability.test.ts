import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { queueAuditEventBackground } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  auditFailedAuthAfter,
  auditPasswordReset,
  getSignInAuthMethod,
  signInAuditDatabaseHook,
} from "./better-auth-observability";
import { finalizeSuccessfulSignIn } from "./sign-in-tracking";
import { logAuthAttempt, shouldLogAuthFailure } from "./utils";

vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({
  queueAuditEventBackground: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: { user: { findUnique: vi.fn() } },
}));

vi.mock("./sign-in-tracking", () => ({
  finalizeSuccessfulSignIn: vi.fn(),
}));

vi.mock("./utils", () => ({
  logAuthAttempt: vi.fn(),
  shouldLogAuthFailure: vi.fn(),
}));

describe("getSignInAuthMethod (signedIn audit allow-list)", () => {
  test.each([
    ["/sign-in/email", "password"],
    ["/two-factor/verify-totp", "password"],
    ["/two-factor/verify-backup-code", "password"],
    ["/callback/google", "sso"],
    ["/oauth2/callback/azuread", "sso"],
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
