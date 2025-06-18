import { logSignOut } from "@/modules/auth/lib/utils";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { logSignOutAction } from "./sign-out";

// Mock the dependencies
vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("@/modules/auth/lib/utils", () => ({
  logSignOut: vi.fn(),
}));

// Clear the existing mock from vitestSetup.ts
vi.unmock("@/modules/auth/actions/sign-out");

describe("logSignOutAction", () => {
  const mockUserId = "user123";
  const mockUserEmail = "test@example.com";
  const mockContext = {
    reason: "user_initiated" as const,
    redirectUrl: "https://example.com",
    organizationId: "org123",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("calls logSignOut with correct parameters", async () => {
    await logSignOutAction(mockUserId, mockUserEmail, mockContext);

    expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, mockContext);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("calls logSignOut with minimal parameters", async () => {
    const minimalContext = {};

    await logSignOutAction(mockUserId, mockUserEmail, minimalContext);

    expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, minimalContext);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("calls logSignOut with context containing only reason", async () => {
    const contextWithReason = { reason: "session_timeout" as const };

    await logSignOutAction(mockUserId, mockUserEmail, contextWithReason);

    expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, contextWithReason);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("calls logSignOut with context containing only redirectUrl", async () => {
    const contextWithRedirectUrl = { redirectUrl: "https://redirect.com" };

    await logSignOutAction(mockUserId, mockUserEmail, contextWithRedirectUrl);

    expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, contextWithRedirectUrl);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("calls logSignOut with context containing only organizationId", async () => {
    const contextWithOrgId = { organizationId: "org456" };

    await logSignOutAction(mockUserId, mockUserEmail, contextWithOrgId);

    expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, contextWithOrgId);
    expect(logSignOut).toHaveBeenCalledTimes(1);
  });

  test("handles all possible reason values", async () => {
    const reasons = [
      "user_initiated",
      "account_deletion",
      "email_change",
      "session_timeout",
      "forced_logout",
    ] as const;

    for (const reason of reasons) {
      const context = { reason };
      await logSignOutAction(mockUserId, mockUserEmail, context);

      expect(logSignOut).toHaveBeenCalledWith(mockUserId, mockUserEmail, context);
    }

    expect(logSignOut).toHaveBeenCalledTimes(reasons.length);
  });

  test("logs error and re-throws when logSignOut throws an Error", async () => {
    const mockError = new Error("Failed to log sign out");
    vi.mocked(logSignOut).mockImplementation(() => {
      throw mockError;
    });

    await expect(() => logSignOutAction(mockUserId, mockUserEmail, mockContext)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith("Failed to log sign out event", {
      userId: mockUserId,
      context: mockContext,
      error: mockError.message,
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test("logs error and re-throws when logSignOut throws a non-Error", async () => {
    const mockError = "String error";
    vi.mocked(logSignOut).mockImplementation(() => {
      throw mockError;
    });

    await expect(() => logSignOutAction(mockUserId, mockUserEmail, mockContext)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith("Failed to log sign out event", {
      userId: mockUserId,
      context: mockContext,
      error: mockError,
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test("logs error with empty context when logSignOut throws", async () => {
    const mockError = new Error("Failed to log sign out");
    const emptyContext = {};
    vi.mocked(logSignOut).mockImplementation(() => {
      throw mockError;
    });

    await expect(() => logSignOutAction(mockUserId, mockUserEmail, emptyContext)).rejects.toThrow(mockError);

    expect(logger.error).toHaveBeenCalledWith("Failed to log sign out event", {
      userId: mockUserId,
      context: emptyContext,
      error: mockError.message,
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  test("does not log error when logSignOut succeeds", async () => {
    await logSignOutAction(mockUserId, mockUserEmail, mockContext);

    expect(logger.error).not.toHaveBeenCalled();
  });
});
