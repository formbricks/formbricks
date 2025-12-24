import { type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { tearDown } from "@/lib/common/setup";
import { UpdateQueue } from "@/lib/user/update-queue";
import { logout, setUserId } from "@/lib/user/user";

// Mock dependencies
vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/user/update-queue", () => ({
  UpdateQueue: {
    getInstance: vi.fn(() => ({
      updateUserId: vi.fn(),
      processUpdates: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/setup", () => ({
  tearDown: vi.fn(),
}));

describe("user.ts", () => {
  const mockUserId = "test-user-123";

  let getInstanceConfigMock: MockInstance<() => Config>;
  let getInstanceLoggerMock: MockInstance<() => Logger>;
  let getInstanceUpdateQueueMock: MockInstance<() => UpdateQueue>;

  beforeEach(() => {
    vi.clearAllMocks();
    getInstanceConfigMock = vi.spyOn(Config, "getInstance");
    getInstanceLoggerMock = vi.spyOn(Logger, "getInstance");
    getInstanceUpdateQueueMock = vi.spyOn(UpdateQueue, "getInstance");
  });

  describe("setUserId", () => {
    test("returns ok without updating when same userId is already set", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          user: {
            data: {
              userId: mockUserId,
            },
          },
        }),
      };

      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      const mockUpdateQueue = {
        updateUserId: vi.fn(),
        processUpdates: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      getInstanceUpdateQueueMock.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);

      const result = await setUserId(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith("UserId is already set to the same value, skipping");
      expect(mockUpdateQueue.updateUserId).not.toHaveBeenCalled();
      expect(mockUpdateQueue.processUpdates).not.toHaveBeenCalled();
    });

    test("tears down previous state and sets new userId when different userId is set", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          user: {
            data: {
              userId: "existing-user",
            },
          },
        }),
      };

      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      const mockUpdateQueue = {
        updateUserId: vi.fn(),
        processUpdates: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      getInstanceUpdateQueueMock.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);

      const result = await setUserId(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "Different userId is being set, cleaning up previous user state"
      );
      expect(tearDown).toHaveBeenCalled();
      expect(mockUpdateQueue.updateUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
    });

    test("successfully sets userId when none exists", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          user: {
            data: {
              userId: null,
            },
          },
        }),
      };

      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      const mockUpdateQueue = {
        updateUserId: vi.fn(),
        processUpdates: vi.fn(),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      getInstanceUpdateQueueMock.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);
      const result = await setUserId(mockUserId);

      expect(result.ok).toBe(true);
      expect(tearDown).not.toHaveBeenCalled();
      expect(mockUpdateQueue.updateUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    test("successfully logs out and cleans state when userId is set", () => {
      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);

      const result = logout();

      expect(mockLogger.debug).toHaveBeenCalledWith("Logging out and cleaning user state");
      expect(tearDown).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });

    test("successfully logs out and cleans state even when no userId is set", () => {
      const mockLogger = {
        debug: vi.fn(),
        error: vi.fn(),
      };

      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);

      const result = logout();

      expect(mockLogger.debug).toHaveBeenCalledWith("Logging out and cleaning user state");
      expect(tearDown).toHaveBeenCalled();
      expect(result.ok).toBe(true);
    });
  });
});
