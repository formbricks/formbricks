import { Worker } from "bullmq";
import type IORedis from "ioredis";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { JOBS_PREFIX, JOBS_QUEUE_NAME } from "./constants";
import { startJobsRuntime } from "./runtime";

const {
  mockConnectionDisconnect,
  mockConnectionQuit,
  mockQueueClose,
  mockQueueWaitUntilReady,
  mockWorkerClose,
  mockWorkerOn,
  mockWorkerWaitUntilReady,
} = vi.hoisted(() => ({
  mockConnectionDisconnect: vi.fn(),
  mockQueueWaitUntilReady: vi.fn().mockResolvedValue(undefined),
  mockQueueClose: vi.fn().mockResolvedValue(undefined),
  mockWorkerWaitUntilReady: vi.fn().mockResolvedValue(undefined),
  mockWorkerClose: vi.fn().mockResolvedValue(undefined),
  mockWorkerOn: vi.fn(),
  mockConnectionQuit: vi.fn().mockResolvedValue(undefined),
}));

const createMockConnection = (): IORedis =>
  ({
    on: vi.fn(),
    quit: mockConnectionQuit,
    disconnect: mockConnectionDisconnect,
    status: "ready",
  }) as unknown as IORedis;

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./connection", () => ({
  createProducerConnection: vi.fn(() => createMockConnection()),
  createWorkerConnection: vi.fn(() => createMockConnection()),
  closeRedisConnection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./queue", async () => {
  const actual = await vi.importActual("./queue");

  return {
    ...actual,
    createJobsQueue: vi.fn(() => ({
      close: mockQueueClose,
      waitUntilReady: mockQueueWaitUntilReady,
    })),
  };
});

vi.mock("bullmq", () => ({
  Queue: vi.fn(),
  Worker: vi.fn(function MockWorker() {
    return {
      close: mockWorkerClose,
      on: mockWorkerOn,
      waitUntilReady: mockWorkerWaitUntilReady,
    };
  }),
}));

describe("@formbricks/jobs runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("starts a worker with the expected queue and prefix", async () => {
    const runtime = await startJobsRuntime({ redisUrl: "redis://localhost:6379" });

    expect(runtime.workers).toHaveLength(1);
    expect(Worker).toHaveBeenCalledWith(
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 1,
        prefix: JOBS_PREFIX,
      })
    );

    expect(mockWorkerOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));

    await runtime.close();

    expect(mockWorkerClose).toHaveBeenCalledTimes(1);
    expect(mockQueueClose).toHaveBeenCalledTimes(1);
  });

  test("starts multiple workers when configured", async () => {
    const runtime = await startJobsRuntime({
      redisUrl: "redis://localhost:6379",
      concurrency: 4,
      workerCount: 2,
    });

    expect(runtime.workers).toHaveLength(2);
    expect(Worker).toHaveBeenCalledTimes(2);
    expect(Worker).toHaveBeenNthCalledWith(
      1,
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 4,
        prefix: JOBS_PREFIX,
      })
    );
    expect(Worker).toHaveBeenNthCalledWith(
      2,
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 4,
        prefix: JOBS_PREFIX,
      })
    );

    await runtime.close();

    expect(mockWorkerClose).toHaveBeenCalledTimes(2);
  });

  test("rejects invalid runtime tuning values", async () => {
    await expect(startJobsRuntime({ redisUrl: "redis://localhost:6379", concurrency: 0 })).rejects.toThrow(
      "BullMQ worker concurrency must be a positive integer"
    );
    await expect(startJobsRuntime({ redisUrl: "redis://localhost:6379", workerCount: 0 })).rejects.toThrow(
      "BullMQ worker count must be a positive integer"
    );

    expect(Worker).not.toHaveBeenCalled();
  });
});
