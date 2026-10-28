import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  verifyEmailChangeToken: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  updateBrevoCustomer: vi.fn(),
  applyIPRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/jwt", () => ({ verifyEmailChangeToken: mocks.verifyEmailChangeToken }));
vi.mock("@/modules/auth/lib/user", () => ({ getUser: mocks.getUser, updateUser: mocks.updateUser }));
vi.mock("@/modules/auth/lib/brevo", () => ({ updateBrevoCustomer: mocks.updateBrevoCustomer }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: mocks.applyIPRateLimit,
  applyRateLimit: vi.fn(),
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    userId: "unknown",
    userType: "api",
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const before = { id: USER_ID, email: "old@example.com", emailVerified: true };
const after = { id: USER_ID, email: "new@example.com", emailVerified: true };

const verify = (
  body: unknown = { token: "signed-token" },
  headers: Record<string, string> = SAME_ORIGIN_HEADERS
) =>
  POST(
    new NextRequest("http://localhost/api/internal/email-change-verifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
  mocks.verifyEmailChangeToken.mockResolvedValue({ id: USER_ID, email: "new@example.com" });
  mocks.getUser.mockResolvedValue(before);
  mocks.updateUser.mockResolvedValue(after);
});

describe("POST /api/internal/email-change-verifications", () => {
  test("switches the account to the confirmed address, answering 204 with nothing about the account", async () => {
    const response = await verify();

    expect(response.status).toBe(204);
    expect(await response.text()).toBe("");
    expect(mocks.updateUser).toHaveBeenCalledWith(USER_ID, { email: "new@example.com", emailVerified: true });
    expect(mocks.updateBrevoCustomer).toHaveBeenCalledWith({ id: USER_ID, email: "new@example.com" });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "user",
        status: "success",
        userId: "unknown",
        userType: "user",
        targetId: USER_ID,
        oldObject: before,
        newObject: after,
      })
    );
  });

  test("spends the client IP's verification budget first, and stops at 429 before reading the token", async () => {
    mocks.applyIPRateLimit.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached.", 60)
    );

    const response = await verify();

    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.verifyEmail);
    expect(response.status).toBe(429);
    expect(mocks.verifyEmailChangeToken).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  test("answers 422 for a token that is invalid, expired or no longer bound to the credentials", async () => {
    mocks.verifyEmailChangeToken.mockRejectedValue(new Error("Email change token is no longer valid"));

    const response = await verify();

    expect(response.status).toBe(422);
    expect((await response.json()).details).toEqual({ reason: "invalid_or_expired" });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ status: "failure" }));
  });

  test.each([
    ["no token", {}],
    ["an empty token", { token: "" }],
    ["an unknown field", { token: "t", email: "attacker@example.com" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await verify(body)).status).toBe(400);
    expect(mocks.verifyEmailChangeToken).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await verify(undefined, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
