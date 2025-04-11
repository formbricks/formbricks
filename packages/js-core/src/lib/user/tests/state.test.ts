import { Config } from "@/lib/common/config";
import { addUserStateExpiryCheckListener, clearUserStateExpiryCheckListener } from "@/lib/user/state";
import { type MockInstance, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockUserId = "user_123";

vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
}));

describe("User State Expiry Check Listener", () => {
  let mockJSConfig: MockInstance<() => Config>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // Simulate timers

    mockJSConfig = vi.spyOn(Config, "getInstance");
  });

  afterEach(() => {
    clearUserStateExpiryCheckListener(); // Ensure cleanup after each test
  });

  test("should set an interval if not already set and update user state expiry when userId exists", () => {
    const mockConfig = {
      get: vi.fn().mockReturnValue({
        user: { data: { userId: mockUserId } },
      }),
      update: vi.fn(),
    };

    mockJSConfig.mockReturnValue(mockConfig as unknown as Config);

    addUserStateExpiryCheckListener();

    // Fast-forward time by 1 minute (60,000 ms)
    vi.advanceTimersByTime(60_000);

    // Ensure config.update was called with extended expiry time
    expect(mockConfig.update).toHaveBeenCalledWith({
      user: {
        data: { userId: mockUserId },
        expiresAt: expect.any(Date) as Date,
      },
    });
  });

  test("should not update user state expiry if userId does not exist", () => {
    const mockConfig = {
      get: vi.fn().mockReturnValue({
        user: { data: { userId: null } },
      }),
      update: vi.fn(),
    };

    mockJSConfig.mockReturnValue(mockConfig as unknown as Config);

    addUserStateExpiryCheckListener();
    vi.advanceTimersByTime(60_000); // Fast-forward 1 minute

    expect(mockConfig.update).not.toHaveBeenCalled(); // Ensures no update when no userId
  });

  test("should not set multiple intervals if already set", () => {
    const mockConfig = {
      get: vi.fn().mockReturnValue({
        user: { data: { userId: mockUserId } },
      }),
      update: vi.fn(),
    };

    mockJSConfig.mockReturnValue(mockConfig as unknown as Config);

    addUserStateExpiryCheckListener();
    addUserStateExpiryCheckListener(); // Call again to check if it prevents multiple intervals

    vi.advanceTimersByTime(60_000); // Fast-forward 1 minute

    expect(mockConfig.update).toHaveBeenCalledTimes(1);
  });

  test("should clear interval when clearUserStateExpiryCheckListener is called", () => {
    const mockConfig = {
      get: vi.fn(),
      update: vi.fn(),
    };

    mockJSConfig.mockReturnValue(mockConfig as unknown as Config);

    addUserStateExpiryCheckListener();
    clearUserStateExpiryCheckListener();

    vi.advanceTimersByTime(60_000); // Fast-forward 1 minute

    expect(mockConfig.update).not.toHaveBeenCalled();
  });
});
