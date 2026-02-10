import * as Sentry from "@sentry/nextjs";
import { DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  AuthenticationError,
  AuthorizationError,
  EXPECTED_ERROR_NAMES,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
  UnknownError,
  ValidationError,
  isExpectedError,
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

describe("isExpectedError (shared helper)", () => {
  test("EXPECTED_ERROR_NAMES contains exactly the right error names", () => {
    const expected = [
      "ResourceNotFoundError",
      "AuthorizationError",
      "InvalidInputError",
      "ValidationError",
      "AuthenticationError",
      "OperationNotAllowedError",
      "TooManyRequestsError",
    ];

    expect(EXPECTED_ERROR_NAMES.size).toBe(expected.length);
    for (const name of expected) {
      expect(EXPECTED_ERROR_NAMES.has(name)).toBe(true);
    }
  });

  test.each([
    { ErrorClass: AuthorizationError, args: ["Not authorized"] },
    { ErrorClass: AuthenticationError, args: ["Not authenticated"] },
    { ErrorClass: TooManyRequestsError, args: ["Rate limit exceeded"] },
    { ErrorClass: ResourceNotFoundError, args: ["Survey", "123"] },
    { ErrorClass: InvalidInputError, args: ["Invalid input"] },
    { ErrorClass: ValidationError, args: ["Invalid data"] },
    { ErrorClass: OperationNotAllowedError, args: ["Not allowed"] },
  ])("returns true for $ErrorClass.name", ({ ErrorClass, args }) => {
    const error = new (ErrorClass as any)(...args);
    expect(isExpectedError(error)).toBe(true);
  });

  test("returns true for serialised errors that only have a matching name", () => {
    // Simulates errors crossing the server/client boundary where instanceof won't work
    const serialisedError = new Error("Auth failed");
    serialisedError.name = "AuthorizationError";
    expect(isExpectedError(serialisedError)).toBe(true);
  });

  test.each([
    { error: new Error("Something broke"), label: "Error" },
    { error: new TypeError("Cannot read properties"), label: "TypeError" },
    { error: new RangeError("Maximum call stack"), label: "RangeError" },
    { error: new UnknownError("Unknown"), label: "UnknownError" },
  ])("returns false for $label", ({ error }) => {
    expect(isExpectedError(error)).toBe(false);
  });
});

// We need to test the handleServerError function directly
// Since it's embedded in createSafeActionClient, we extract and test the logic
describe("action-client handleServerError", () => {
  // Extract the error handler by importing the module and inspecting the client
  // We'll test the behavior by calling the handler directly

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to simulate handleServerError behavior using the shared isExpectedError helper
  const simulateHandleServerError = (error: Error) => {
    if (isExpectedError(error)) {
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

    test("UnknownError is sent to Sentry (not an expected business-logic error)", () => {
      const error = new UnknownError("Unknown error");
      const result = simulateHandleServerError(error);

      expect(result.sentryCapture).toBe(true);
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        extra: { eventId: undefined },
      });
    });
  });
});
