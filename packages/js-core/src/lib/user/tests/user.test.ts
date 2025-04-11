import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { setup, tearDown } from "@/lib/common/setup";
import { UpdateQueue } from "@/lib/user/update-queue";
import { logout, setUserId } from "@/lib/user/user";
import { type Mock, type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";

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
  setup: vi.fn(),
}));

describe("user.ts", () => {
  const mockUserId = "test-user-123";
  const mockEnvironmentId = "env-123";
  const mockAppUrl = "https://test.com";

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
    test("returns error if userId is already set", async () => {
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

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);

      const result = await setUserId(mockUserId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("forbidden");
        expect(result.error.status).toBe(403);
      }
      expect(mockLogger.error).toHaveBeenCalled();
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
      expect(mockUpdateQueue.updateUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    test("successfully sets up formbricks after logout", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environmentId: mockEnvironmentId,
          appUrl: mockAppUrl,
          user: { data: { userId: mockUserId } },
        }),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      (setup as Mock).mockResolvedValue(undefined);

      const result = await logout();

      expect(tearDown).toHaveBeenCalled();
      expect(setup).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
        appUrl: mockAppUrl,
      });
      expect(result.ok).toBe(true);
    });

    test("returns error if setup fails", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environmentId: mockEnvironmentId,
          appUrl: mockAppUrl,
          user: { data: { userId: mockUserId } },
        }),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as Config);

      const mockError = { code: "network_error", message: "Failed to connect" };
      (setup as Mock).mockRejectedValue(mockError);

      const result = await logout();

      expect(tearDown).toHaveBeenCalled();
      expect(setup).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
        appUrl: mockAppUrl,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(mockError);
      }
    });
  });
});
