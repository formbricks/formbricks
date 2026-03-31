import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { reportApiError } from "./api-error-reporter";

const mocks = vi.hoisted(() => ({
  contextualLoggerError: vi.fn(),
  loggerError: vi.fn(),
  sentryScope: {
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setLevel: vi.fn(),
    setContext: vi.fn(),
  },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: typeof mocks.sentryScope) => void) => {
    callback(mocks.sentryScope);
    return mocks.sentryScope;
  }),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({
      error: mocks.contextualLoggerError,
    })),
    error: mocks.loggerError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/constants", () => ({
  IS_PRODUCTION: true,
  SENTRY_DSN: "test-dsn",
}));

describe("reportApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("uses low-cardinality tags and stores request details in context", () => {
    const error = new Error("boom");
    const request = new Request("https://api.test/api/v2/client/cld1234567890abcdef123456/displays", {
      method: "POST",
    });
    request.headers.set("x-request-id", "req-123");

    reportApiError({
      request,
      status: 500,
      error,
    });

    expect(mocks.contextualLoggerError).toHaveBeenCalledWith("API V2 Error Details");
    expect(mocks.sentryScope.setTag).toHaveBeenCalledWith("apiVersion", "v2");
    expect(mocks.sentryScope.setTag).toHaveBeenCalledWith("method", "POST");
    expect(mocks.sentryScope.setTag).toHaveBeenCalledWith("routeScope", "client");
    expect(mocks.sentryScope.setTag).not.toHaveBeenCalledWith(
      "path",
      "/api/v2/client/cld1234567890abcdef123456/displays"
    );
    expect(mocks.sentryScope.setTag).not.toHaveBeenCalledWith("correlationId", "req-123");
    expect(mocks.sentryScope.setContext).toHaveBeenCalledWith(
      "apiRequest",
      expect.objectContaining({
        apiVersion: "v2",
        correlationId: "req-123",
        method: "POST",
        path: "/api/v2/client/cld1234567890abcdef123456/displays",
        routeScope: "client",
        status: 500,
      })
    );
    expect(mocks.sentryScope.setExtra).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        name: "Error",
        message: "boom",
      })
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  test("serializes cyclic errors without throwing", () => {
    const error = new Error("cyclic boom") as Error & {
      metadata?: Record<string, unknown>;
      self?: unknown;
    };
    error.self = error;
    error.metadata = { nested: error };

    const request = new Request("https://api.test/api/v2/management/responses", {
      method: "POST",
    });

    expect(() =>
      reportApiError({
        request,
        status: 500,
        error,
      })
    ).not.toThrow();

    expect(mocks.sentryScope.setExtra).toHaveBeenCalledWith(
      "error",
      expect.objectContaining({
        name: "Error",
        message: "cyclic boom",
        self: "[Circular]",
        metadata: {
          nested: "[Circular]",
        },
      })
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  test("swallows logger failures and still reports to Sentry", () => {
    vi.mocked(logger.withContext).mockImplementationOnce(() => {
      throw new Error("logger unavailable");
    });

    const request = new Request("https://api.test/api/v2/management/surveys", {
      method: "GET",
    });

    expect(() =>
      reportApiError({
        request,
        status: 500,
        error: new Error("survey failure"),
      })
    ).not.toThrow();

    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({
        apiVersion: "v2",
        path: "/api/v2/management/surveys",
        status: 500,
        reportingError: expect.objectContaining({
          name: "Error",
          message: "logger unavailable",
        }),
      }),
      "Failed to report API error"
    );
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
