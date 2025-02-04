import { type Mock, type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";
import { RNConfig } from "@/lib/common/config";
import { deinitalize, init } from "@/lib/common/initialize";
import { Logger } from "@/lib/common/logger";
import { UpdateQueue } from "@/lib/user/update-queue";
import { logout, logoutUser, setUserId } from "@/lib/user/user";

// Mock dependencies
vi.mock("@/lib/common/config", () => ({
  RNConfig: {
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

vi.mock("@/lib/common/initialize", () => ({
  deinitalize: vi.fn(),
  init: vi.fn(),
}));

describe("user.ts", () => {
  const mockUserId = "test-user-123";
  const mockEnvironmentId = "env-123";
  const mockAppUrl = "https://test.com";

  let getInstanceConfigMock: MockInstance<() => RNConfig>;
  let getInstanceLoggerMock: MockInstance<() => Logger>;
  let getInstanceUpdateQueueMock: MockInstance<() => UpdateQueue>;

  beforeEach(() => {
    vi.clearAllMocks();
    getInstanceConfigMock = vi.spyOn(RNConfig, "getInstance");
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

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as RNConfig);
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

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as RNConfig);
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      getInstanceUpdateQueueMock.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);
      const result = await setUserId(mockUserId);

      expect(result.ok).toBe(true);
      expect(mockUpdateQueue.updateUserId).toHaveBeenCalledWith(mockUserId);
      expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
    });
  });

  describe("logoutUser", () => {
    test("calls deinitalize", async () => {
      await logoutUser();
      expect(deinitalize).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    test("successfully reinitializes after logout", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environmentId: mockEnvironmentId,
          appUrl: mockAppUrl,
          user: { data: { userId: mockUserId } },
        }),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as RNConfig);

      (init as Mock).mockResolvedValue(undefined);

      const result = await logout();

      expect(deinitalize).toHaveBeenCalled();
      expect(init).toHaveBeenCalledWith({
        environmentId: mockEnvironmentId,
        appUrl: mockAppUrl,
      });
      expect(result.ok).toBe(true);
    });

    test("returns error if initialization fails", async () => {
      const mockConfig = {
        get: vi.fn().mockReturnValue({
          environmentId: mockEnvironmentId,
          appUrl: mockAppUrl,
          user: { data: { userId: mockUserId } },
        }),
      };

      getInstanceConfigMock.mockReturnValue(mockConfig as unknown as RNConfig);

      const mockError = { code: "network_error", message: "Failed to connect" };
      (init as Mock).mockRejectedValue(mockError);

      const result = await logout();

      expect(deinitalize).toHaveBeenCalled();
      expect(init).toHaveBeenCalledWith({
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
