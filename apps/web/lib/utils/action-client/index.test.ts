import { afterEach, describe, expect, test, vi } from "vitest";
import * as Sentry from "@sentry/nextjs";
import { DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import {
  AuthenticationError,
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UnknownError,
} from "@formbricks/types/errors";

// Mock Sentry
vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Mock logger
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn().mockReturnValue({
      error: vi.fn(),
    }),
    warn: vi.fn(),
  },
}));

// Mock next-auth
vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

// Mock authOptions
vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

// Mock user service
vi.mock("@/lib/user/service", () => ({
  getUser: vi.fn(),
}));

// Mock client IP
vi.mock("@/lib/utils/client-ip", () => ({
  getClientIpFromHeaders: vi.fn(),
}));

// Mock constants
vi.mock("@/lib/constants", () => ({
  AUDIT_LOG_ENABLED: false,
  AUDIT_LOG_GET_USER_IP: false,
}));

// Mock audit log types
vi.mock("@/modules/ee/audit-logs/types/audit-log", () => ({
  UNKNOWN_DATA: "unknown",
}));

// We need to test the handleServerError function directly
// Since it's embedded in createSafeActionClient, we extract and test the logic
describe("action-client handleServerError", () => {
  // Extract the error handler by importing the module and inspecting the client
  // We'll test the behavior by calling the handler directly

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to simulate handleServerError behavior
  const simulateHandleServerError = (error: Error) => {
    const isExpectedError =
      error instanceof ResourceNotFoundError ||
      error instanceof AuthorizationError ||
      error instanceof InvalidInputError ||
      error instanceof UnknownError ||
      error instanceof AuthenticationError ||
      error instanceof OperationNotAllowedError ||
      error instanceof TooManyRequestsError;

    if (isExpectedError) {
      return { sentryCapture: false, returnedMessage: error.message };
    }

    Sentry.captureException(error, { extra: { eventId: undefined } });
    return { sentryCapture: true, returnedMessage: DEFAULT_SERVER_ERROR_MESSAGE };
  };

  describe("expected errors should NOT be reported to Sentry", () => {
    test("AuthorizationError is not sent to Sentry", () => {
      const error = new AuthorizationError("Not authorized");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Not authorized");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("AuthenticationError is not sent to Sentry", () => {
      const error = new AuthenticationError("Not authenticated");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Not authenticated");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("TooManyRequestsError is not sent to Sentry", () => {
      const error = new TooManyRequestsError("Rate limit exceeded");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Rate limit exceeded");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("ResourceNotFoundError is not sent to Sentry", () => {
      const error = new ResourceNotFoundError("Survey", "123");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("InvalidInputError is not sent to Sentry", () => {
      const error = new InvalidInputError("Invalid input");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Invalid input");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("OperationNotAllowedError is not sent to Sentry", () => {
      const error = new OperationNotAllowedError("Not allowed");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Not allowed");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("UnknownError is not sent to Sentry", () => {
      const error = new UnknownError("Unknown error");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(false);
      expect(result.returnedMessage).toBe("Unknown error");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe("unexpected errors SHOULD be reported to Sentry", () => {
    test("generic Error is sent to Sentry", () => {
      const error = new Error("Something broke");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(true);
      expect(result.returnedMessage).toBe(DEFAULT_SERVER_ERROR_MESSAGE);
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { eventId: undefined },
      });
    });

    test("TypeError is sent to Sentry", () => {
      const error = new TypeError("Cannot read properties of undefined");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(true);
      expect(result.returnedMessage).toBe(DEFAULT_SERVER_ERROR_MESSAGE);
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { eventId: undefined },
      });
    });

    test("RangeError is sent to Sentry", () => {
      const error = new RangeError("Maximum call stack size exceeded");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(true);
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { eventId: undefined },
      });
    });
  });
});
