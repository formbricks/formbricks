import { type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { emitFormbricksEvent, onFormbricksEvent, resetFormbricksEventSubscribers } from "@/lib/common/events";
import { Logger } from "@/lib/common/logger";
import { tearDown } from "@/lib/common/setup";
import { EmbeddedDataStore } from "@/lib/survey/embedded-data";
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

    test("should reject userId longer than 255 characters and not send updates", async () => {
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

      const longId = "a".repeat(256);
      const result = await setUserId(longId);

      expect(result.ok).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith("UserId exceeds maximum length of 255 characters");
      expect(mockUpdateQueue.updateUserId).not.toHaveBeenCalled();
      expect(mockUpdateQueue.processUpdates).not.toHaveBeenCalled();
    });

    test("does not tear down the existing user when the replacement userId is too long", async () => {
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

      const longId = "a".repeat(256);
      const result = await setUserId(longId);

      expect(result.ok).toBe(true);
      expect(mockLogger.error).toHaveBeenCalledWith("UserId exceeds maximum length of 255 characters");
      expect(tearDown).not.toHaveBeenCalled();
      expect(mockUpdateQueue.updateUserId).not.toHaveBeenCalled();
      expect(mockUpdateQueue.processUpdates).not.toHaveBeenCalled();
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

    test("keeps event subscriptions registered — the docs promise handlers survive logout (ENG-1814)", () => {
      const mockLogger = { debug: vi.fn(), error: vi.fn() };
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);

      const handler = vi.fn();
      onFormbricksEvent("formbricks_survey_shown", handler);

      const result = logout();
      expect(result.ok).toBe(true);

      emitFormbricksEvent("formbricks_survey_shown", { surveyId: "survey_1" });
      expect(handler).toHaveBeenCalledWith({ surveyId: "survey_1" });

      resetFormbricksEventSubscribers();
    });

    test("clears the Embedded Data bag — the previous user's context must not leak (ENG-1844)", () => {
      const mockLogger = { debug: vi.fn(), error: vi.fn() };
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);

      const store = EmbeddedDataStore.getInstance();
      store.setEmbeddedData({ hashed_email: "abc123", pageType: "product" });

      const result = logout();

      expect(result.ok).toBe(true);
      expect(store.getSnapshot()).toEqual({});
    });
  });

  describe("Embedded Data bag on identity switch (ENG-1844)", () => {
    const mockLogger = { debug: vi.fn(), error: vi.fn() };
    const mockUpdateQueue = { updateUserId: vi.fn(), processUpdates: vi.fn().mockResolvedValue(undefined) };

    const configWithUser = (userId: string | null): Config =>
      ({ get: vi.fn().mockReturnValue({ user: { data: { userId } } }) }) as unknown as Config;

    beforeEach(() => {
      getInstanceLoggerMock.mockReturnValue(mockLogger as unknown as Logger);
      getInstanceUpdateQueueMock.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);
      EmbeddedDataStore.getInstance().clearEmbeddedData();
    });

    test("switching to a different userId clears the bag", async () => {
      getInstanceConfigMock.mockReturnValue(configWithUser("user-a"));
      EmbeddedDataStore.getInstance().setEmbeddedData({ hashed_email: "user-a-hash" });

      await setUserId("user-b");

      expect(EmbeddedDataStore.getInstance().getSnapshot()).toEqual({});
    });

    test("first-time identification keeps the bag — context pushed before identifying is legitimate", async () => {
      getInstanceConfigMock.mockReturnValue(configWithUser(null));
      EmbeddedDataStore.getInstance().setEmbeddedData({ pageType: "product" });

      await setUserId("user-a");

      expect(EmbeddedDataStore.getInstance().getSnapshot()).toEqual({ pageType: "product" });
    });
  });
});
