import { beforeEach, describe, expect, test, vi } from "vitest";
import { CommandQueue, CommandType } from "@/lib/common/command-queue";
import { checkSetup } from "@/lib/common/status";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type Result } from "@/types/error";

// Mock the setup module so we can control checkSetup()
vi.mock("@/lib/common/status", () => ({
  checkSetup: vi.fn(),
}));

// Mock the UpdateQueue
vi.mock("@/lib/user/update-queue", () => ({
  UpdateQueue: {
    getInstance: vi.fn(() => ({
      isEmpty: vi.fn(),
      processUpdates: vi.fn(),
    })),
  },
}));

describe("CommandQueue", () => {
  let queue: CommandQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new CommandQueue();
  });

  test("executes commands in FIFO order", async () => {
    const executionOrder: string[] = [];

    const cmdA = vi.fn(async () => {
      executionOrder.push("A");
      return Promise.resolve({ ok: true, data: undefined });
    });
    const cmdB = vi.fn(async () => {
      executionOrder.push("B");
      return Promise.resolve({ ok: true, data: undefined });
    });

    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    await queue.add(cmdA, CommandType.GeneralAction, true);
    await queue.add(cmdB, CommandType.GeneralAction, true);

    await queue.wait();

    expect(executionOrder).toEqual(["A", "B"]);
  });

  test("pauses execution if checkSetup() fails (Strict FIFO)", async () => {
    const cmd = vi.fn();

    // 1. Queue is blocked by missing setup
    vi.mocked(checkSetup).mockReturnValue({
      ok: false,
      error: { code: "not_setup", message: "Not setup" },
    });

    await queue.add(cmd, CommandType.GeneralAction, true);

    // Should NOT execute yet
    expect(cmd).not.toHaveBeenCalled();

    // 2. Setup completes and run() is triggered (simulating setup.ts behavior)
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });
    await queue.run();

    // Should execute now
    expect(cmd).toHaveBeenCalled();
  });

  test("does NOT executing later commands if first is blocked (Strict FIFO)", async () => {
    const cmd1 = vi.fn();
    const cmd2 = vi.fn(); // This does NOT require setup, but should still be blocked by FIFO

    // Block the queue
    vi.mocked(checkSetup).mockReturnValue({
      ok: false,
      error: { code: "not_setup", message: "Not setup" },
    });

    await queue.add(cmd1, CommandType.GeneralAction, true); // Requires setup
    await queue.add(cmd2, CommandType.GeneralAction, false); // Does NOT require setup

    // Queue should process head -> see blocked -> return.
    // cmd2 should NOT run even though it doesn't need setup.
    expect(cmd1).not.toHaveBeenCalled();
    expect(cmd2).not.toHaveBeenCalled();

    // Unblock
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });
    await queue.run();

    expect(cmd1).toHaveBeenCalled();
    expect(cmd2).toHaveBeenCalled();
  });

  test("handles re-entrancy gracefully (recursive run calls)", async () => {
    const executionOrder: string[] = [];

    // Command that triggers a recursive run()
    const recursiveCmd = vi.fn(async () => {
      executionOrder.push("start");
      // This should return immediately because running=true
      await queue.run();
      executionOrder.push("end");
      return { ok: true, data: undefined };
    });

    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    await queue.add(recursiveCmd, CommandType.GeneralAction, false);
    await queue.wait();

    expect(executionOrder).toEqual(["start", "end"]);
  });

  test("processes UpdateQueue before executing GeneralAction commands", async () => {
    const mockUpdateQueue = {
      isEmpty: vi.fn().mockReturnValue(false),
      processUpdates: vi.fn().mockResolvedValue(undefined),
    };

    const mockUpdateQueueInstance = vi.spyOn(UpdateQueue, "getInstance");
    mockUpdateQueueInstance.mockReturnValue(mockUpdateQueue as unknown as UpdateQueue);

    const generalActionCmd = vi.fn((): Promise<Result<void, unknown>> => {
      return Promise.resolve({ ok: true, data: undefined });
    });

    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    await queue.add(generalActionCmd, CommandType.GeneralAction, true);
    await queue.wait();

    expect(mockUpdateQueue.isEmpty).toHaveBeenCalled();
    expect(mockUpdateQueue.processUpdates).toHaveBeenCalled();
    expect(generalActionCmd).toHaveBeenCalled();
  });

  test("logs errors if a command throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => { });
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    const failingCmd = vi.fn(async () => {
      throw new Error("fail");
    });

    await queue.add(failingCmd, CommandType.GeneralAction, true);
    await queue.wait();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
