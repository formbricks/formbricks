import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockStartJobsRuntime = vi.fn();
const mockDebug = vi.fn();
const mockError = vi.fn();
const mockGetJobsWorkerBootstrapConfig = vi.fn();
const TEST_TIMEOUT_MS = 15_000;
const slowTest = (name: string, fn: () => Promise<void>): void => {
  test(name, fn, TEST_TIMEOUT_MS);
};

vi.mock("@formbricks/jobs", () => ({
  startJobsRuntime: mockStartJobsRuntime,
}));

vi.mock("@/lib/jobs/config", () => ({
  getJobsWorkerBootstrapConfig: mockGetJobsWorkerBootstrapConfig,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: mockDebug,
    error: mockError,
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("instrumentation-jobs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    const { resetJobsWorkerRegistrationForTests } = await import("./instrumentation-jobs");
    await resetJobsWorkerRegistrationForTests();
  });

  slowTest("skips worker startup when disabled", async () => {
    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: false,
      runtimeOptions: null,
    });

    const { registerJobsWorker } = await import("./instrumentation-jobs");
    const result = await registerJobsWorker();

    expect(result).toBeNull();
    expect(mockStartJobsRuntime).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith("BullMQ worker startup skipped");
  });

  slowTest("starts the worker only once", async () => {
    const mockRuntime = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: true,
      runtimeOptions: {
        concurrency: 4,
        redisUrl: "redis://localhost:6379",
        workerCount: 2,
      },
    });

    mockStartJobsRuntime.mockResolvedValue(mockRuntime);

    const { registerJobsWorker } = await import("./instrumentation-jobs");
    const first = await registerJobsWorker();
    const second = await registerJobsWorker();

    expect(first).toBe(mockRuntime);
    expect(second).toBe(mockRuntime);
    expect(mockStartJobsRuntime).toHaveBeenCalledTimes(1);
    expect(mockStartJobsRuntime).toHaveBeenCalledWith({
      concurrency: 4,
      redisUrl: "redis://localhost:6379",
      workerCount: 2,
    });
  });

  slowTest("reuses the in-flight startup promise", async () => {
    const mockRuntime = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: true,
      runtimeOptions: {
        concurrency: 2,
        redisUrl: "redis://localhost:6379",
        workerCount: 1,
      },
    });

    let resolveRuntime: ((value: typeof mockRuntime) => void) | undefined;
    mockStartJobsRuntime.mockReturnValue(
      new Promise((resolve) => {
        resolveRuntime = resolve;
      })
    );

    const { registerJobsWorker } = await import("./instrumentation-jobs");
    const firstPromise = registerJobsWorker();
    const secondPromise = registerJobsWorker();

    expect(mockStartJobsRuntime).toHaveBeenCalledTimes(1);

    resolveRuntime?.(mockRuntime);

    await expect(firstPromise).resolves.toBe(mockRuntime);
    await expect(secondPromise).resolves.toBe(mockRuntime);
  });

  slowTest("logs and rethrows startup failures", async () => {
    const startupError = new Error("startup failed");

    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: true,
      runtimeOptions: {
        concurrency: 1,
        redisUrl: "redis://localhost:6379",
        workerCount: 1,
      },
    });

    mockStartJobsRuntime.mockRejectedValue(startupError);

    const { registerJobsWorker } = await import("./instrumentation-jobs");

    await expect(registerJobsWorker()).rejects.toThrow("startup failed");
    expect(mockError).toHaveBeenCalledWith({ err: startupError }, "BullMQ worker registration failed");
  });

  slowTest("clears registration state even when reset close fails", async () => {
    const failingRuntime = {
      close: vi.fn().mockRejectedValue(new Error("close failed")),
    };
    const nextRuntime = {
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: true,
      runtimeOptions: {
        concurrency: 1,
        redisUrl: "redis://localhost:6379",
        workerCount: 1,
      },
    });

    mockStartJobsRuntime.mockResolvedValueOnce(failingRuntime).mockResolvedValueOnce(nextRuntime);

    const { registerJobsWorker, resetJobsWorkerRegistrationForTests } =
      await import("./instrumentation-jobs");

    await expect(registerJobsWorker()).resolves.toBe(failingRuntime);
    await expect(resetJobsWorkerRegistrationForTests()).rejects.toThrow("close failed");
    await expect(registerJobsWorker()).resolves.toBe(nextRuntime);

    expect(mockStartJobsRuntime).toHaveBeenCalledTimes(2);
  });
});
