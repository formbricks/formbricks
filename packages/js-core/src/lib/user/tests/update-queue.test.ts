import { type Mock, type MockInstance, beforeEach, describe, expect, test, vi } from "vitest";
import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { mockAttributes, mockUserId1, mockUserId2 } from "@/lib/user/tests/__mocks__/update-queue.mock";
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
      data: { hasWarnings: false },
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

  test("hasPendingWork returns false when no updates and no flush in flight", () => {
    expect(updateQueue.hasPendingWork()).toBe(false);
  });

  test("hasPendingWork returns true when updates are queued", () => {
    updateQueue.updateUserId(mockUserId1);
    expect(updateQueue.hasPendingWork()).toBe(true);
  });

  test("hasPendingWork returns true while processUpdates flush is in flight", () => {
    (sendUpdates as Mock).mockReturnValue({
      ok: true,
      data: { hasWarnings: false },
    });

    updateQueue.updateUserId(mockUserId1);
    // Start processing but don't await — the debounce means the flush is in-flight
    void updateQueue.processUpdates();

    expect(updateQueue.hasPendingWork()).toBe(true);
  });

  test("waitForPendingWork returns true immediately when no pending work", async () => {
    const result = await updateQueue.waitForPendingWork();
    expect(result).toBe(true);
  });

  test("waitForPendingWork returns true when processUpdates succeeds", async () => {
    (sendUpdates as Mock).mockReturnValue({
      ok: true,
      data: { hasWarnings: false },
    });

    updateQueue.updateUserId(mockUserId1);
    void updateQueue.processUpdates();

    const result = await updateQueue.waitForPendingWork();

    expect(result).toBe(true);
    expect(updateQueue.hasPendingWork()).toBe(false);
    expect(sendUpdates).toHaveBeenCalled();
  });

  test("waitForPendingWork returns false when processUpdates rejects", async () => {
    loggerMock.mockReturnValue(mockLogger as unknown as Logger);
    (sendUpdates as Mock).mockRejectedValue(new Error("network error"));

    updateQueue.updateUserId(mockUserId1);
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentionally swallowing rejection to avoid unhandled promise
    const processPromise = updateQueue.processUpdates().catch(() => {});

    const result = await updateQueue.waitForPendingWork();
    expect(result).toBe(false);
    await processPromise;
  });

  test("waitForPendingWork returns false when flush hangs past timeout", async () => {
    vi.useFakeTimers();

    // sendUpdates returns a promise that never resolves, simulating a network hang
    // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentionally never-resolving promise
    (sendUpdates as Mock).mockReturnValue(new Promise(() => {}));

    updateQueue.updateUserId(mockUserId1);
    void updateQueue.processUpdates();

    const resultPromise = updateQueue.waitForPendingWork();

    // Advance past the debounce delay (500ms) so the handler fires and hangs on sendUpdates
    await vi.advanceTimersByTimeAsync(500);
    // Advance past the pending work timeout (5000ms)
    await vi.advanceTimersByTimeAsync(5000);

    const result = await resultPromise;
    expect(result).toBe(false);

    vi.useRealTimers();
  });

  test("processUpdates reuses pending flush instead of creating orphaned promises", async () => {
    (sendUpdates as Mock).mockReturnValue({
      ok: true,
      data: { hasWarnings: false },
    });

    updateQueue.updateUserId(mockUserId1);

    // First call creates the flush promise
    const firstPromise = updateQueue.processUpdates();

    // Second call while first is still pending should not create a new flush
    updateQueue.updateAttributes({ name: mockAttributes.name });
    const secondPromise = updateQueue.processUpdates();

    // Both promises should resolve (second is not orphaned)
    await Promise.all([firstPromise, secondPromise]);

    expect(updateQueue.hasPendingWork()).toBe(false);
  });
});
