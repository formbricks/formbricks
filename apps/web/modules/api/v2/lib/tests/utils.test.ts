import * as Sentry from "@sentry/nextjs";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";
import { logger } from "@formbricks/logger";
import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import { formatZodError, handleApiError, logApiError, logApiRequest } from "../utils";

const mockRequest = new Request("http://localhost/api/v2/test");

// Add the request id header
mockRequest.headers.set("x-request-id", "123");

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn(),
}));

// Mock SENTRY_DSN constant while preserving untouched exports.
vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    SENTRY_DSN: "mocked-sentry-dsn",
    IS_PRODUCTION: true,
    AUDIT_LOG_ENABLED: true,
    ENCRYPTION_KEY: "mocked-encryption-key",
    REDIS_URL: undefined,
  };
});

describe("utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleApiError", () => {
    test('return bad request response for "bad_request" error', async () => {
      const details = [{ field: "param", issue: "invalid" }];
      const error: ApiErrorResponseV2 = { type: "bad_request", details };

      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error.code).toBe(400);
      expect(body.error.message).toBe("Bad Request");
      expect(body.error.details).toEqual(details);
    });

    test('return unauthorized response for "unauthorized" error', async () => {
      const error: ApiErrorResponseV2 = { type: "unauthorized" };
      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error.code).toBe(401);
      expect(body.error.message).toBe("Unauthorized");
    });

    test('return forbidden response for "forbidden" error', async () => {
      const error: ApiErrorResponseV2 = { type: "forbidden" };
      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error.code).toBe(403);
      expect(body.error.message).toBe("Forbidden");
    });

    test('return not found response for "not_found" error', async () => {
      const details = [{ field: "resource", issue: "not found" }];
      const error: ApiErrorResponseV2 = { type: "not_found", details };

      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe(404);
      expect(body.error.message).toBe("Not Found");
      expect(body.error.details).toEqual(details);
    });

    test('return conflict response for "conflict" error', async () => {
      const error: ApiErrorResponseV2 = { type: "conflict" };
      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe(409);
      expect(body.error.message).toBe("Conflict");
    });

    test('return unprocessable entity response for "unprocessable_entity" error', async () => {
      const details = [{ field: "data", issue: "malformed" }];
      const error: ApiErrorResponseV2 = { type: "unprocessable_entity", details };

      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe(422);
      expect(body.error.message).toBe("Unprocessable Entity");
      expect(body.error.details).toEqual(details);
    });

    test('return too many requests response for "too_many_requests" error', async () => {
      const error: ApiErrorResponseV2 = { type: "too_many_requests" };
      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(429);
      const body = await response.json();
      expect(body.error.code).toBe(429);
      expect(body.error.message).toBe("Too Many Requests");
    });

    test('return internal server error response for "internal_server_error" error with default message', async () => {
      const details = [{ field: "server", issue: "error occurred" }];
      const error: ApiErrorResponseV2 = { type: "internal_server_error", details };

      const response = handleApiError(mockRequest, error);
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error.code).toBe(500);
      expect(body.error.message).toBe("Internal Server Error");
      expect(body.error.details).toEqual([
        { field: "error", issue: "An error occurred while processing your request. Please try again later." },
      ]);
      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "API V2 error, id: 123",
        }),
        expect.objectContaining({
          tags: expect.objectContaining({
            apiVersion: "v2",
            correlationId: "123",
            method: "GET",
            path: "/api/v2/test",
          }),
          extra: expect.objectContaining({
            error,
            originalError: error,
          }),
          contexts: expect.objectContaining({
            apiRequest: expect.objectContaining({
              apiVersion: "v2",
              correlationId: "123",
              method: "GET",
              path: "/api/v2/test",
              status: 500,
            }),
          }),
        })
      );
    });

    test("preserves originalError separately when provided", () => {
      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };
      const originalError = new Error("boom");

      handleApiError(mockRequest, error, undefined, originalError);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "API V2 error, id: 123",
        }),
        expect.objectContaining({
          extra: expect.objectContaining({
            error,
            originalError: expect.objectContaining({
              message: "boom",
            }),
          }),
        })
      );
    });
  });

  describe("formatZodError", () => {
    test("correctly format a Zod error", () => {
      const zodError = {
        issues: [
          {
            path: ["field1"],
            message: "Invalid value for field1",
          },
          {
            path: ["field2", "subfield"],
            message: "Field2 subfield is required",
          },
        ],
      } as ZodError;

      const formatted = formatZodError(zodError);
      expect(formatted).toEqual([
        { field: "field1", issue: "Invalid value for field1" },
        { field: "field2.subfield", issue: "Field2 subfield is required" },
      ]);
    });

    test("return an empty array if there are no issues", () => {
      const zodError = { issues: [] } as unknown as ZodError;
      const formatted = formatZodError(zodError);
      expect(formatted).toEqual([]);
    });
  });

  describe("logApiRequest", () => {
    test("logs API request details", () => {
      const infoMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        info: infoMock,
      });

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test?apikey=123&token=abc&safeParam=value");
      mockRequest.headers.set("x-request-id", "123");
      mockRequest.headers.set("x-start-time", Date.now().toString());

      logApiRequest(mockRequest, 200);

      expect(withContextMock).toHaveBeenCalled();
      expect(infoMock).toHaveBeenCalledWith("API Request Details");

      logger.withContext = originalWithContext;
    });

    test("logs API request details without correlationId and without safe query params", () => {
      const infoMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        info: infoMock,
      });

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test?apikey=123&token=abc");
      mockRequest.headers.delete("x-request-id");
      mockRequest.headers.set("x-start-time", (Date.now() - 100).toString());

      logApiRequest(mockRequest, 200);

      expect(withContextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          path: "/api/test",
          responseStatus: 200,
          queryParams: {},
        })
      );

      expect(infoMock).toHaveBeenCalledWith("API Request Details");

      logger.withContext = originalWithContext;
    });
  });

  describe("logApiError", () => {
    test("logs API error details with method and path", () => {
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/v2/management/surveys", { method: "POST" });
      mockRequest.headers.set("x-request-id", "123");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      expect(withContextMock).toHaveBeenCalledWith({
        apiVersion: "v2",
        correlationId: "123",
        method: "POST",
        path: "/api/v2/management/surveys",
        error,
        status: 500,
      });

      expect(errorMock).toHaveBeenCalledWith("API V2 Error Details");

      logger.withContext = originalWithContext;
    });

    test("logs API error details without correlationId", () => {
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/v2/test");
      mockRequest.headers.delete("x-request-id");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      expect(withContextMock).toHaveBeenCalledWith({
        apiVersion: "v2",
        correlationId: "",
        method: "GET",
        path: "/api/v2/test",
        error,
        status: 500,
      });

      expect(errorMock).toHaveBeenCalledWith("API V2 Error Details");

      logger.withContext = originalWithContext;
    });

    test("sends internal server errors to Sentry with direct capture context", () => {
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/v2/management/surveys", { method: "DELETE" });
      mockRequest.headers.set("x-request-id", "123");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      expect(withContextMock).toHaveBeenCalledWith({
        apiVersion: "v2",
        correlationId: "123",
        method: "DELETE",
        path: "/api/v2/management/surveys",
        error,
        status: 500,
      });

      expect(errorMock).toHaveBeenCalledWith("API V2 Error Details");

      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "API V2 error, id: 123",
        }),
        expect.objectContaining({
          tags: expect.objectContaining({
            apiVersion: "v2",
            correlationId: "123",
            method: "DELETE",
            path: "/api/v2/management/surveys",
          }),
          extra: expect.objectContaining({
            error,
            originalError: error,
          }),
          contexts: expect.objectContaining({
            apiRequest: expect.objectContaining({
              apiVersion: "v2",
              correlationId: "123",
              method: "DELETE",
              path: "/api/v2/management/surveys",
              status: 500,
            }),
          }),
        })
      );

      logger.withContext = originalWithContext;
    });

    test("does not send to Sentry for non-internal_server_error types", () => {
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      vi.mocked(Sentry.captureException).mockClear();

      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/v2/management/surveys");
      mockRequest.headers.set("x-request-id", "456");

      const error: ApiErrorResponseV2 = {
        type: "not_found",
        details: [{ field: "survey", issue: "not found" }],
      };

      logApiError(mockRequest, error);

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.withScope).not.toHaveBeenCalled();
      expect(errorMock).toHaveBeenCalledWith("API V2 Error Details");

      logger.withContext = originalWithContext;
    });
  });
});
