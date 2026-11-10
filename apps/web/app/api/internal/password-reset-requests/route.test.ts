import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { PRE_LOGIN_BODY_LIMIT_BYTES } from "@/app/api/internal/lib/limits";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  processPasswordResetRequest: vi.fn(),
  applyIPRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getAuditRequestMetadata: vi.fn(),
  constants: { PASSWORD_RESET_DISABLED: false, AUDIT_LOG_ENABLED: true },
  // Callbacks handed to `after()`. Captured rather than run, so a test can tell "scheduled for after the
  // response" from "done before it" — the whole property this route exists to hold.
  afterCallbacks: [] as (() => unknown)[],
}));

vi.mock("@/modules/auth/forgot-password/lib/password-reset-request", () => ({
  processPasswordResetRequest: mocks.processPasswordResetRequest,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: mocks.applyIPRateLimit,
  applyRateLimit: vi.fn(),
}));
vi.mock("@/modules/ee/audit-logs/lib/request-metadata", () => ({
  UNKNOWN_AUDIT_REQUEST_METADATA: { ipAddress: "unknown", userAgent: "unknown" },
  getAuditRequestMetadata: mocks.getAuditRequestMetadata,
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "user-agent": "vitest" })),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn((callback: () => unknown) => {
    mocks.afterCallbacks.push(callback);
  }),
}));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get PASSWORD_RESET_DISABLED() {
    return mocks.constants.PASSWORD_RESET_DISABLED;
  },
  get AUDIT_LOG_ENABLED() {
    return mocks.constants.AUDIT_LOG_ENABLED;
  },
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const request = (
  body: unknown = { email: "someone@example.com" },
  headers: Record<string, string> = SAME_ORIGIN_HEADERS
) =>
  POST(
    new NextRequest("http://localhost/api/internal/password-reset-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    {} as never
  );

/** Run what the route deferred past its response, as Next does once the response is sent. */
const runAfterCallbacks = async () => {
  for (const callback of mocks.afterCallbacks.splice(0)) {
    await callback();
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.PASSWORD_RESET_DISABLED = false;
  mocks.constants.AUDIT_LOG_ENABLED = true;
  mocks.afterCallbacks.length = 0;
  mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
  mocks.queueAuditEvent.mockResolvedValue(undefined);
  mocks.getAuditRequestMetadata.mockResolvedValue({ ipAddress: "203.0.113.7", userAgent: "vitest" });
});

describe("POST /api/internal/password-reset-requests", () => {
  test("answers 204 before doing anything that depends on the address", async () => {
    const response = await request();

    // The response is out and the per-address work has not started: so nothing about the address —
    // whether it exists, has a password, or is throttled — can show in the answer or its timing.
    expect(response.status).toBe(204);
    expect(mocks.processPasswordResetRequest).not.toHaveBeenCalled();

    await runAfterCallbacks();
    expect(mocks.processPasswordResetRequest).toHaveBeenCalledExactlyOnceWith({
      email: "someone@example.com",
      requestHeaders: expect.any(Headers),
      requestMetadata: { ipAddress: "203.0.113.7", userAgent: "vitest" },
    });
  });

  test("hands over a copy of the request headers, which Better Auth reads after the response", async () => {
    await request();
    await runAfterCallbacks();

    const { requestHeaders } = mocks.processPasswordResetRequest.mock.calls[0][0];
    expect(requestHeaders.get("user-agent")).toBe("vitest");
  });

  test("records no request metadata when audit logging is off", async () => {
    mocks.constants.AUDIT_LOG_ENABLED = false;

    await request();
    await runAfterCallbacks();

    expect(mocks.getAuditRequestMetadata).not.toHaveBeenCalled();
    expect(mocks.processPasswordResetRequest.mock.calls[0][0].requestMetadata).toEqual({
      ipAddress: "unknown",
      userAgent: "unknown",
    });
  });

  test("applies the IP rate limit, with its config, before scheduling anything", async () => {
    await request();

    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.forgotPassword);
    expect(mocks.afterCallbacks).toHaveLength(1);
  });

  test("answers 429, schedules nothing and audits nothing when the IP rate limit is exceeded", async () => {
    mocks.applyIPRateLimit.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached.", 60)
    );

    const response = await request();

    expect(response.status).toBe(429);
    expect((await response.json()).detail).toBe("Maximum number of requests reached.");
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers 403 when password reset is disabled, before spending any budget, and audits the refusal", async () => {
    mocks.constants.PASSWORD_RESET_DISABLED = true;

    const response = await request();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Password reset is disabled");
    expect(mocks.applyIPRateLimit).not.toHaveBeenCalled();
    expect(mocks.afterCallbacks).toHaveLength(0);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "passwordReset", targetType: "user", status: "failure" })
    );
  });

  test("leaves the success event to the deferred work, which alone knows if a reset was requested", async () => {
    await request();

    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test.each([
    ["no email", {}],
    ["an invalid email", { email: "not-an-email" }],
    ["an unknown field", { email: "someone@example.com", userId: "someone" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await request(body)).status).toBe(400);
    expect(mocks.afterCallbacks).toHaveLength(0);
  });

  test(`refuses a body over ${PRE_LOGIN_BODY_LIMIT_BYTES} bytes with 413`, async () => {
    const body = JSON.stringify({ email: `${"a".repeat(PRE_LOGIN_BODY_LIMIT_BYTES)}@example.com` });

    expect((await request(body)).status).toBe(413);
  });

  test("refuses a cross-site request (CSRF), though there is no session to ride", async () => {
    expect((await request(undefined, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.applyIPRateLimit).not.toHaveBeenCalled();
  });
});
