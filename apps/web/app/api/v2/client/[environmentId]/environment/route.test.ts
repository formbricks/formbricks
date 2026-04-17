import * as Sentry from "@sentry/nextjs";
import { type NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyIPRateLimit: vi.fn(),
  getEnvironmentState: vi.fn(),
  contextualLoggerError: vi.fn(),
}));

vi.mock("@/app/api/v1/client/[environmentId]/environment/lib/environmentState", () => ({
  getEnvironmentState: mocks.getEnvironmentState,
}));

vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyIPRateLimit: mocks.applyIPRateLimit,
  applyRateLimit: vi.fn(),
}));

vi.mock("@/modules/core/rate-limit/rate-limit-configs", () => ({
  rateLimitConfigs: {
    api: {
      client: { windowMs: 60000, max: 100 },
      v1: { windowMs: 60000, max: 1000 },
    },
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: mocks.contextualLoggerError,
      warn: vi.fn(),
      info: vi.fn(),
    })),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    AUDIT_LOG_ENABLED: false,
    IS_PRODUCTION: true,
    SENTRY_DSN: "test-dsn",
    ENCRYPTION_KEY: "test-key",
    REDIS_URL: "redis://localhost:6379",
  };
});

const createMockRequest = (url: string, headers = new Map<string, string>()): NextRequest => {
  const parsedUrl = new URL(url);

  return {
    method: "GET",
    url,
    headers: {
      get: (key: string) => headers.get(key),
    },
    nextUrl: {
      pathname: parsedUrl.pathname,
    },
  } as unknown as NextRequest;
};

describe("api/v2 client environment route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.applyIPRateLimit.mockResolvedValue(undefined);
  });

  test("reports v1-backed failures as v2 and keeps the response payload unchanged", async () => {
    const underlyingError = new Error("Environment load failed");
    mocks.getEnvironmentState.mockRejectedValue(underlyingError);

    const request = createMockRequest(
      "https://api.test/api/v2/client/ck12345678901234567890123/environment",
      new Map([["x-request-id", "req-v2-env"]])
    );

    const { GET } = await import("./route");
    const response = await GET(request, {
      params: Promise.resolve({
        environmentId: "ck12345678901234567890123",
      }),
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      code: "internal_server_error",
      message: "An error occurred while processing your request.",
      details: {},
    });

    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      underlyingError,
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v2",
          correlationId: "req-v2-env",
          method: "GET",
          path: "/api/v2/client/ck12345678901234567890123/environment",
        }),
        extra: expect.objectContaining({
          error: expect.objectContaining({
            name: "Error",
            message: "Environment load failed",
          }),
          originalError: expect.objectContaining({
            name: "Error",
            message: "Environment load failed",
          }),
        }),
        contexts: expect.objectContaining({
          apiRequest: expect.objectContaining({
            apiVersion: "v2",
            correlationId: "req-v2-env",
            method: "GET",
            path: "/api/v2/client/ck12345678901234567890123/environment",
            status: 500,
          }),
        }),
      })
    );
  });
});
