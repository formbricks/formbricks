import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { reportApiError } from "./api-error-reporter";

const loggerMocks = vi.hoisted(() => {
  const contextualError = vi.fn();
  const rootError = vi.fn();
  const withContext = vi.fn(() => ({
    error: contextualError,
  }));

  return {
    contextualError,
    rootError,
    withContext,
  };
});

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: loggerMocks.withContext,
    error: loggerMocks.rootError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();

  return {
    ...actual,
    IS_PRODUCTION: true,
    SENTRY_DSN: "dsn",
  };
});

describe("reportApiError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("captures real errors directly with structured context", () => {
    const request = new Request("https://app.test/api/v2/client/environment", {
      method: "POST",
      headers: {
        "x-request-id": "req-1",
      },
    });
    const error = new Error("boom");

    reportApiError({
      request,
      status: 500,
      error,
    });

    expect(loggerMocks.withContext).toHaveBeenCalledWith(
      expect.objectContaining({
        apiVersion: "v2",
        correlationId: "req-1",
        method: "POST",
        path: "/api/v2/client/environment",
        status: 500,
        error: expect.objectContaining({
          name: "Error",
          message: "boom",
        }),
      })
    );
    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v2",
          correlationId: "req-1",
          method: "POST",
          path: "/api/v2/client/environment",
        }),
        extra: expect.objectContaining({
          error: expect.objectContaining({
            name: "Error",
            message: "boom",
          }),
          originalError: expect.objectContaining({
            name: "Error",
            message: "boom",
          }),
        }),
        contexts: expect.objectContaining({
          apiRequest: expect.objectContaining({
            apiVersion: "v2",
            correlationId: "req-1",
            method: "POST",
            path: "/api/v2/client/environment",
            status: 500,
          }),
        }),
      })
    );
  });

  test("captures non-error payloads with a synthetic error while preserving additional data", () => {
    const request = new Request("https://app.test/api/v1/management/surveys", {
      headers: {
        "x-request-id": "req-2",
      },
    });
    const payload = {
      type: "internal_server_error",
      details: [{ field: "server", issue: "error occurred" }],
    };

    reportApiError({
      request,
      status: 500,
      error: payload,
      originalError: payload,
    });

    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "API V1 error, id: req-2",
      }),
      expect.objectContaining({
        tags: expect.objectContaining({
          apiVersion: "v1",
          correlationId: "req-2",
          method: "GET",
          path: "/api/v1/management/surveys",
        }),
        extra: expect.objectContaining({
          error: payload,
          originalError: payload,
        }),
      })
    );
  });

  test("swallows Sentry failures after logging a fallback reporter error", () => {
    vi.mocked(Sentry.captureException).mockImplementation(() => {
      throw new Error("sentry down");
    });

    const request = new Request("https://app.test/api/v2/client/displays", {
      headers: {
        "x-request-id": "req-3",
      },
    });

    expect(() =>
      reportApiError({
        request,
        status: 500,
        error: new Error("boom"),
      })
    ).not.toThrow();

    expect(loggerMocks.rootError).toHaveBeenCalledWith(
      expect.objectContaining({
        apiVersion: "v2",
        correlationId: "req-3",
        method: "GET",
        path: "/api/v2/client/displays",
        status: 500,
        reportingError: expect.objectContaining({
          name: "Error",
          message: "sentry down",
        }),
      }),
      "Failed to report API error"
    );
  });

  test("serializes cyclic payloads without throwing", () => {
    const request = new Request("https://app.test/api/v2/client/responses", {
      headers: {
        "x-request-id": "req-4",
      },
    });
    const payload: Record<string, unknown> = {
      type: "internal_server_error",
    };

    payload.self = payload;

    expect(() =>
      reportApiError({
        request,
        status: 500,
        error: payload,
        originalError: payload,
      })
    ).not.toThrow();

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "API V2 error, id: req-4",
      }),
      expect.objectContaining({
        extra: expect.objectContaining({
          error: {
            type: "internal_server_error",
            self: "[Circular]",
          },
          originalError: {
            type: "internal_server_error",
            self: "[Circular]",
          },
        }),
      })
    );
  });
});
