import { APIError } from "better-auth/api";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import { auditFailedAuthAfter, getSignInAuthMethod } from "./better-auth-observability";
import { logAuthAttempt, shouldLogAuthFailure } from "./utils";

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
});
