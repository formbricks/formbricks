import { type Mock, type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";
import { mockAttributes, mockUserId1, mockUserId2 } from "@/lib/user/tests/__mocks__/update-queue.mock";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { sendUpdates } from "@/lib/user/update";
import { UpdateQueue } from "@/lib/user/update-queue";

// Mock dependencies
vi.mock("@/lib/common/config", () => ({
  Config: {
    getInstance: vi.fn(() => ({
      get: vi.fn(() => ({
        user: {
          data: {
            userId: "mock-user-id",
          },
        },
      })),
      update: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/common/logger", () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

vi.mock("@/lib/user/update", () => ({
  sendUpdates: vi.fn(),
}));

describe("UpdateQueue", () => {
  let updateQueue: UpdateQueue;
  let loggerMock: MockInstance<() => Logger>;

  const mockLogger = {
    debug: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (UpdateQueue as unknown as { instance: null }).instance = null;
    updateQueue = UpdateQueue.getInstance();
    loggerMock = vi.spyOn(Logger, "getInstance");
  });

  test("getInstance returns singleton instance", () => {
    const instance1 = UpdateQueue.getInstance();
    const instance2 = UpdateQueue.getInstance();
    expect(instance1).toBe(instance2);
  });

  test("updateUserId sets userId correctly when updates is null", () => {
    const userId = mockUserId1;
    updateQueue.updateUserId(userId);
    expect(updateQueue.getUpdates()).toEqual({
      userId,
      attributes: {},
    });
  });

  test("updateUserId updates existing userId correctly", () => {
    const userId1 = mockUserId1;
    const userId2 = mockUserId2;

    updateQueue.updateUserId(userId1);
    updateQueue.updateUserId(userId2);

    expect(updateQueue.getUpdates()).toEqual({
      userId: userId2,
      attributes: {},
    });
  });

  test("updateAttributes sets attributes correctly when updates is null", () => {
    const attributes = mockAttributes;
    updateQueue.updateAttributes(attributes);

    expect(updateQueue.getUpdates()).toEqual({
      userId: "mock-user-id", // from mocked config
      attributes,
    });
  });

  test("updateAttributes merges with existing attributes", () => {
    updateQueue.updateAttributes({ name: mockAttributes.name });
    updateQueue.updateAttributes({ email: mockAttributes.email });

    expect(updateQueue.getUpdates()).toEqual({
      userId: "mock-user-id",
      attributes: {
        name: mockAttributes.name,
        email: mockAttributes.email,
      },
    });
  });

  test("clearUpdates resets updates to null", () => {
    updateQueue.updateAttributes({ name: mockAttributes.name });
    updateQueue.clearUpdates();
    expect(updateQueue.getUpdates()).toBeNull();
  });

  test("isEmpty returns true when updates is null", () => {
    expect(updateQueue.isEmpty()).toBe(true);
  });

  test("isEmpty returns false when updates exist", () => {
    updateQueue.updateAttributes({ name: mockAttributes.name });
    expect(updateQueue.isEmpty()).toBe(false);
  });

  test("processUpdates debounces multiple calls", async () => {
    // Call processUpdates multiple times in quick succession

    (sendUpdates as Mock).mockReturnValue({
      ok: true,
    });

    updateQueue.updateAttributes({ name: mockAttributes.name });
    updateQueue.updateAttributes({ email: mockAttributes.email });

    // Wait for debounce timeout
    await new Promise((resolve) => {
      setTimeout(resolve, 600);
    });

    await updateQueue.processUpdates();

    // Should only be called once with the merged updates
    expect(sendUpdates).toHaveBeenCalledTimes(1);
  });

  test("processUpdates handles language attribute specially when no userId", async () => {
    const configUpdateMock = vi.fn();
    (Config.getInstance as Mock).mockImplementation(() => ({
      get: vi.fn(() => ({
        user: { data: { userId: "" } },
      })),
      update: configUpdateMock,
    }));

    updateQueue.updateAttributes({ language: "en" });
    await updateQueue.processUpdates();

    expect(configUpdateMock).toHaveBeenCalled();
  });

  test("processUpdates logs error when setting attributes without userId", async () => {
    loggerMock.mockReturnValue(mockLogger as unknown as Logger);
    (Config.getInstance as Mock).mockImplementation(() => ({
      get: vi.fn(() => ({
        user: { data: { userId: "" } },
      })),
    }));

    updateQueue.updateAttributes({ name: mockAttributes.name });
    await updateQueue.processUpdates();

    expect(mockLogger.error).toHaveBeenCalledWith(
      "Formbricks can't set attributes without a userId! Please set a userId first with the setUserId function"
    );
  });
});
