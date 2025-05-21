import { CommandQueue, CommandType } from "@/lib/common/command-queue";
import { checkSetup } from "@/lib/common/setup";
import { type Result } from "@/types/error";
import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock the setup module so we can control checkSetup()
vi.mock("@/lib/common/setup", () => ({
  checkSetup: vi.fn(),
}));

describe("CommandQueue", () => {
  let queue: CommandQueue;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Create a fresh CommandQueue instance
    queue = new CommandQueue();
  });

  test("executes commands in FIFO order", async () => {
    const executionOrder: string[] = [];

    // Mock commands with proper Result returns
    const cmdA = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executionOrder.push("A");
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });
    const cmdB = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executionOrder.push("B");
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });
    const cmdC = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executionOrder.push("C");
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });

    // We'll assume checkSetup always ok for this test
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    // Enqueue commands
    await queue.add(cmdA, CommandType.GeneralAction, true);
    await queue.add(cmdB, CommandType.GeneralAction, true);
    await queue.add(cmdC, CommandType.GeneralAction, true);

    // Wait for them to finish
    await queue.wait();

    expect(executionOrder).toEqual(["A", "B", "C"]);
  });

  test("skips execution if checkSetup() fails", async () => {
    const cmd = vi.fn(async (): Promise<void> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve();
        }, 10);
      });
    });

    // Force checkSetup to fail
    vi.mocked(checkSetup).mockReturnValue({
      ok: false,
      error: {
        code: "not_setup",
        message: "Not setup",
      },
    });

    await queue.add(cmd, CommandType.GeneralAction, true);
    await queue.wait();

    // Command should never have been called
    expect(cmd).not.toHaveBeenCalled();
  });

  test("executes command if checkSetup is false (no check)", async () => {
    const cmd = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });

    // checkSetup is irrelevant in this scenario, but let's mock it anyway
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    // Here we pass 'false' for the second argument, so no check is performed
    await queue.add(cmd, CommandType.GeneralAction, false);
    await queue.wait();

    expect(cmd).toHaveBeenCalledTimes(1);
  });

  test("logs errors if a command throws or returns error", async () => {
    // Spy on console.error to see if it's called
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      return {
        ok: true,
        data: undefined,
      };
    });

    // Force checkSetup to succeed
    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    // Mock command that fails
    const failingCmd = vi.fn(async () => {
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve("some error");
        }, 10);
      });

      throw new Error("some error");
    });

    await queue.add(failingCmd, CommandType.GeneralAction, true);
    await queue.wait();

    expect(consoleErrorSpy).toHaveBeenCalledWith("🧱 Formbricks - Global error: ", expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test("resolves wait() after all commands complete", async () => {
    const cmd1 = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });
    const cmd2 = vi.fn(async (): Promise<Result<void, unknown>> => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({ ok: true, data: undefined });
        }, 10);
      });
    });

    vi.mocked(checkSetup).mockReturnValue({ ok: true, data: undefined });

    await queue.add(cmd1, CommandType.GeneralAction, true);
    await queue.add(cmd2, CommandType.GeneralAction, true);

    await queue.wait();

    // By the time `await queue.wait()` resolves, both commands should be done
    expect(cmd1).toHaveBeenCalled();
    expect(cmd2).toHaveBeenCalled();
  });
});
