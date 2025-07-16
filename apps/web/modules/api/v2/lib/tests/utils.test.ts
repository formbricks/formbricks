import { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import * as Sentry from "@sentry/nextjs";
import { describe, expect, test, vi } from "vitest";
import { ZodError } from "zod";
import { logger } from "@formbricks/logger";
import { formatZodError, handleApiError, logApiError, logApiRequest } from "../utils";

const mockRequest = new Request("http://localhost");

// Add the request id header
mockRequest.headers.set("x-request-id", "123");

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock SENTRY_DSN constant
vi.mock("@/lib/constants", () => ({
  SENTRY_DSN: "mocked-sentry-dsn",
  IS_PRODUCTION: true,
  AUDIT_LOG_ENABLED: true,
  ENCRYPTION_KEY: "mocked-encryption-key",
  REDIS_URL: undefined,
}));

describe("utils", () => {
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
      // Mock the withContext method and its returned info method
      const infoMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        info: infoMock,
      });

      // Replace the original withContext with our mock
      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test?apikey=123&token=abc&safeParam=value");
      mockRequest.headers.set("x-request-id", "123");
      mockRequest.headers.set("x-start-time", Date.now().toString());

      logApiRequest(mockRequest, 200);

      // Verify withContext was called
      expect(withContextMock).toHaveBeenCalled();
      // Verify info was called on the child logger
      expect(infoMock).toHaveBeenCalledWith("API Request Details");

      // Restore the original method
      logger.withContext = originalWithContext;
    });

    test("logs API request details without correlationId and without safe query params", () => {
      // Mock the withContext method and its returned info method
      const infoMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        info: infoMock,
      });

      // Replace the original withContext with our mock
      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test?apikey=123&token=abc");
      mockRequest.headers.delete("x-request-id");
      mockRequest.headers.set("x-start-time", (Date.now() - 100).toString());

      logApiRequest(mockRequest, 200);

      // Verify withContext was called with the expected context
      expect(withContextMock).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          path: "/api/test",
          responseStatus: 200,
          queryParams: {},
        })
      );

      // Verify info was called on the child logger
      expect(infoMock).toHaveBeenCalledWith("API Request Details");

      // Restore the original method
      logger.withContext = originalWithContext;
    });
  });

  describe("logApiError", () => {
    test("logs API error details", () => {
      // Mock the withContext method and its returned error method
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      // Replace the original withContext with our mock
      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test");
      mockRequest.headers.set("x-request-id", "123");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      // Verify withContext was called with the expected context
      expect(withContextMock).toHaveBeenCalledWith({
        correlationId: "123",
        error,
      });

      // Verify error was called on the child logger
      expect(errorMock).toHaveBeenCalledWith("API Error Details");

      // Restore the original method
      logger.withContext = originalWithContext;
    });

    test("logs API error details without correlationId", () => {
      // Mock the withContext method and its returned error method
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      // Replace the original withContext with our mock
      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test");
      mockRequest.headers.delete("x-request-id");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      // Verify withContext was called with the expected context
      expect(withContextMock).toHaveBeenCalledWith({
        correlationId: "",
        error,
      });

      // Verify error was called on the child logger
      expect(errorMock).toHaveBeenCalledWith("API Error Details");

      // Restore the original method
      logger.withContext = originalWithContext;
    });

    test("log API error details with SENTRY_DSN set", () => {
      // Mock the withContext method and its returned error method
      const errorMock = vi.fn();
      const withContextMock = vi.fn().mockReturnValue({
        error: errorMock,
      });

      // Mock Sentry's captureException method
      vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

      // Replace the original withContext with our mock
      const originalWithContext = logger.withContext;
      logger.withContext = withContextMock;

      const mockRequest = new Request("http://localhost/api/test");
      mockRequest.headers.set("x-request-id", "123");

      const error: ApiErrorResponseV2 = {
        type: "internal_server_error",
        details: [{ field: "server", issue: "error occurred" }],
      };

      logApiError(mockRequest, error);

      // Verify withContext was called with the expected context
      expect(withContextMock).toHaveBeenCalledWith({
        correlationId: "123",
        error,
      });

      // Verify error was called on the child logger
      expect(errorMock).toHaveBeenCalledWith("API Error Details");

      // Verify Sentry.captureException was called
      expect(Sentry.captureException).toHaveBeenCalled();

      // Restore the original method
      logger.withContext = originalWithContext;
    });
  });
});
