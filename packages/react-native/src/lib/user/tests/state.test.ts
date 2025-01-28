import { RNConfig } from "@/lib/common/config";
import { addUserStateExpiryCheckListener, clearUserStateExpiryCheckListener } from "@/lib/user/state";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/lib/common/config", () => ({
  RNConfig: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
      update: vi.fn(),
    })),
  },
}));

describe("User State Expiry Check Listener", () => {
  const mockRNConfig = {
    get: vi.fn(),
    update: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // Simulate timers

    const getRnConfigInstanceMock = vi.spyOn(RNConfig, "getInstance");
    getRnConfigInstanceMock.mockReturnValue(mockRNConfig as unknown as RNConfig);
  });

  afterEach(() => {
    clearUserStateExpiryCheckListener(); // Ensure cleanup after each test
  });

  test("should set an interval if not already set and update user state expiry when userId exists", () => {
    mockRNConfig.get.mockReturnValue({
      user: { data: { userId: "user_123" } },
    });

    addUserStateExpiryCheckListener();
    // expect(setInterval).toHaveBeenCalledTimes(1); // Ensures interval is set once

    // Fast-forward time by 1 minute (60,000 ms)
    vi.advanceTimersByTime(60_000);

    // Ensure config.update was called with extended expiry time
    expect(mockRNConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          expiresAt: expect.any(Date), // Ensures expiry was updated
        }),
      })
    );
  });

  test("should not update user state expiry if userId does not exist", () => {
    mockRNConfig.get.mockReturnValue({
      user: { data: { userId: null } },
    });

    addUserStateExpiryCheckListener();
    vi.advanceTimersByTime(60_000); // Fast-forward 1 minute

    expect(mockRNConfig.update).not.toHaveBeenCalled(); // Ensures no update when no userId
  });

  test("should not set multiple intervals if already set", () => {
    mockRNConfig.get.mockReturnValue({
      user: { data: { userId: "user_123" } },
    });

    addUserStateExpiryCheckListener();
    addUserStateExpiryCheckListener(); // Call again to check if it prevents multiple intervals

    expect(setInterval).toHaveBeenCalledTimes(1); // Should still be called only once
  });

  test("should clear interval when clearUserStateExpiryCheckListener is called", () => {
    addUserStateExpiryCheckListener();
    clearUserStateExpiryCheckListener();

    expect(clearInterval).toHaveBeenCalledTimes(1); // Ensures interval was cleared
  });
});
