import { APIError } from "better-auth/api";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import {
  INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE,
  PASSWORD_COMPROMISED_ERROR_CODE,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  resetPassword: vi.fn(),
  applyIPRateLimit: vi.fn(),
  applyRateLimit: vi.fn(),
  isPasswordCompromisedError: vi.fn(),
  constants: { PASSWORD_RESET_DISABLED: false },
}));

vi.mock("@/modules/auth/lib/auth", () => ({ auth: { api: { resetPassword: mocks.resetPassword } } }));
vi.mock("@/modules/auth/lib/better-auth-hibp", () => ({
  isPasswordCompromisedError: mocks.isPasswordCompromisedError,
}));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: mocks.applyIPRateLimit,
  applyRateLimit: mocks.applyRateLimit,
}));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/constants", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants")>()),
  get PASSWORD_RESET_DISABLED() {
    return mocks.constants.PASSWORD_RESET_DISABLED;
  },
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: vi.fn() }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const BODY = { token: "opaque-reset-token", password: "Password123" };

const reset = (body: unknown = BODY, headers: Record<string, string> = SAME_ORIGIN_HEADERS) =>
  POST(
    new NextRequest("http://localhost/api/internal/password-resets", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    {} as never
  );

const reasonOf = async (response: Response) => (await response.json()).details?.reason;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.PASSWORD_RESET_DISABLED = false;
  mocks.applyIPRateLimit.mockResolvedValue({ allowed: true });
  mocks.resetPassword.mockResolvedValue({ status: true });
  mocks.isPasswordCompromisedError.mockReturnValue(false);
});

describe("POST /api/internal/password-resets", () => {
  test("resets the password through Better Auth, answering 204, without a session", async () => {
    const response = await reset();

    expect(response.status).toBe(204);
    expect(mocks.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ body: { token: BODY.token, newPassword: BODY.password } })
    );
  });

  test("spends the client IP's reset budget before calling Better Auth, and stops at 429", async () => {
    mocks.applyIPRateLimit.mockRejectedValue(
      new TooManyRequestsError("Maximum number of requests reached.", 60)
    );

    const response = await reset();

    expect(mocks.applyIPRateLimit).toHaveBeenCalledWith(rateLimitConfigs.auth.resetPassword);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  test("answers 403 when password reset is disabled, before spending any budget", async () => {
    mocks.constants.PASSWORD_RESET_DISABLED = true;

    expect((await reset()).status).toBe(403);
    expect(mocks.applyIPRateLimit).not.toHaveBeenCalled();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  test("names an invalid, expired or used token with the code the form translates", async () => {
    mocks.resetPassword.mockRejectedValue(new APIError("BAD_REQUEST", { message: "invalid token" }));

    const response = await reset();

    expect(response.status).toBe(422);
    expect(await reasonOf(response)).toBe(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE);
  });

  test("names a breached password as such, not as an invalid link", async () => {
    mocks.resetPassword.mockRejectedValue(new APIError("BAD_REQUEST", { message: "compromised" }));
    mocks.isPasswordCompromisedError.mockReturnValue(true);

    const response = await reset();

    expect(response.status).toBe(422);
    expect(await reasonOf(response)).toBe(PASSWORD_COMPROMISED_ERROR_CODE);
  });

  test("calls a credential-row collision an invalid link, not a server error (ENG-3258)", async () => {
    mocks.resetPassword.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: PrismaErrorType.UniqueConstraintViolation,
        clientVersion: "7",
      })
    );

    const response = await reset();

    expect(response.status).toBe(422);
    expect(await reasonOf(response)).toBe(INVALID_PASSWORD_RESET_TOKEN_ERROR_CODE);
  });

  test("lets an unexpected failure through as a 500", async () => {
    mocks.resetPassword.mockRejectedValue(new Error("db down"));

    expect((await reset()).status).toBe(500);
  });

  test.each([
    ["no token", { password: BODY.password }],
    ["a password too short", { token: "t", password: "short" }],
    ["an unknown field", { ...BODY, userId: "someone" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await reset(body)).status).toBe(400);
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF), though there is no session to ride", async () => {
    expect((await reset(BODY, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });
});
