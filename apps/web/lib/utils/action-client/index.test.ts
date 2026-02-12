import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

// Mock logger — use plain functions for chained calls so vi.resetAllMocks() doesn't break them
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: () => ({ error: vi.fn() }),
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

// ── shared helper tests (pure logic, no action client needed) ──────────

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

// ── integration tests against the real actionClient / authenticatedActionClient ──

describe("actionClient handleServerError", () => {
  // Lazily import so mocks are in place first
  let actionClient: (typeof import("./index"))["actionClient"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./index");
    actionClient = mod.actionClient;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper: create and execute an action that throws the given error
  const executeThrowingAction = async (error: Error) => {
    const action = actionClient.action(async () => {
      throw error;
    });
    return action();
  };

  describe("expected errors should NOT be reported to Sentry", () => {
    test("AuthorizationError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new AuthorizationError("Not authorized"));
      expect(result?.serverError).toBe("Not authorized");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("AuthenticationError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new AuthenticationError("Not authenticated"));
      expect(result?.serverError).toBe("Not authenticated");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("TooManyRequestsError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new TooManyRequestsError("Rate limit exceeded"));
      expect(result?.serverError).toBe("Rate limit exceeded");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("ResourceNotFoundError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new ResourceNotFoundError("Survey", "123"));
      expect(result?.serverError).toContain("Survey");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("InvalidInputError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new InvalidInputError("Invalid input"));
      expect(result?.serverError).toBe("Invalid input");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("ValidationError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new ValidationError("Invalid data"));
      expect(result?.serverError).toBe("Invalid data");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test("OperationNotAllowedError returns its message and is not sent to Sentry", async () => {
      const result = await executeThrowingAction(new OperationNotAllowedError("Not allowed"));
      expect(result?.serverError).toBe("Not allowed");
      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });

  describe("unexpected errors SHOULD be reported to Sentry", () => {
    test("generic Error is sent to Sentry and returns default message", async () => {
      const error = new Error("Something broke");
      const result = await executeThrowingAction(error);
      expect(result?.serverError).toBe(DEFAULT_SERVER_ERROR_MESSAGE);
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ extra: expect.any(Object) })
      );
    });

    test("TypeError is sent to Sentry and returns default message", async () => {
      const error = new TypeError("Cannot read properties of undefined");
      const result = await executeThrowingAction(error);
      expect(result?.serverError).toBe(DEFAULT_SERVER_ERROR_MESSAGE);
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ extra: expect.any(Object) })
      );
    });

    test("UnknownError is sent to Sentry (not an expected business-logic error)", async () => {
      const error = new UnknownError("Unknown error");
      const result = await executeThrowingAction(error);
      expect(result?.serverError).toBe(DEFAULT_SERVER_ERROR_MESSAGE);
      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ extra: expect.any(Object) })
      );
    });
  });
});

describe("authenticatedActionClient", () => {
  let authenticatedActionClient: (typeof import("./index"))["authenticatedActionClient"];
  let getUser: (typeof import("@/lib/user/service"))["getUser"];

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./index");
    authenticatedActionClient = mod.authenticatedActionClient;
    const userService = await import("@/lib/user/service");
    getUser = userService.getUser;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("throws AuthenticationError when there is no session", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);

    const action = authenticatedActionClient.action(async () => "ok");
    const result = await action();

    // handleServerError catches AuthenticationError and returns its message
    expect(result?.serverError).toBe("Not authenticated");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("throws AuthorizationError when user is not found", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getUser).mockResolvedValue(null as any);

    const action = authenticatedActionClient.action(async () => "ok");
    const result = await action();

    expect(result?.serverError).toBe("User not found");
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("executes action successfully when session and user exist", async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user-1" } });
    vi.mocked(getUser).mockResolvedValue({ id: "user-1", name: "Test" } as any);

    const action = authenticatedActionClient.action(async () => "success");
    const result = await action();

    expect(result?.data).toBe("success");
    expect(result?.serverError).toBeUndefined();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
