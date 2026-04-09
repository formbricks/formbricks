import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  type MockRedisConnection,
  type MockWorker,
  asQueue,
  asRedisConnection,
  asWorker,
  createMockLogger,
  createMockQueue,
  createMockRedisConnection,
  createMockWorker,
} from "../test/boundary-mocks";
import { JOBS_PREFIX, JOBS_QUEUE_NAME, JOB_NAMES } from "./constants";
import type * as QueueModule from "./queue";
import { startJobsRuntime } from "./runtime";

type TQueueModule = typeof QueueModule;

let producerConnection = createMockRedisConnection();
let queueMock = createMockQueue();
let workerConnections: MockRedisConnection[] = [];
let workerMocks: MockWorker[] = [];

const mockLogger = createMockLogger();
const mockProcessJob = vi.fn<(job: unknown) => Promise<void>>().mockResolvedValue(undefined);
const mockCloseRedisConnection = vi.fn<(connection: unknown) => Promise<void>>().mockResolvedValue(undefined);
const mockCreateProducerConnection = vi.fn((_: unknown) => asRedisConnection(producerConnection));
const mockCreateWorkerConnection = vi.fn((_: unknown) => {
  const workerConnection = createMockRedisConnection();
  workerConnections.push(workerConnection);
  return asRedisConnection(workerConnection);
});
const mockCreateJobsQueue = vi.fn((_: unknown) => asQueue(queueMock));
const mockWorkerConstructor = vi.fn(function MockWorker(_: string, __: unknown, ___?: unknown) {
  const worker = createMockWorker();
  workerMocks.push(worker);
  return asWorker(worker);
});

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: (context: unknown, message?: string): void => {
      mockLogger.error(context, message);
    },
    info: (context: unknown, message?: string): void => {
      mockLogger.info(context, message);
    },
    warn: (context: unknown, message?: string): void => {
      mockLogger.warn(context, message);
    },
    debug: (context: unknown, message?: string): void => {
      mockLogger.debug(context, message);
    },
  },
}));

vi.mock("./connection", () => ({
  createProducerConnection: (config: unknown) => mockCreateProducerConnection(config),
  createWorkerConnection: (config: unknown) => mockCreateWorkerConnection(config),
  closeRedisConnection: (connection: unknown) => mockCloseRedisConnection(connection),
}));

vi.mock("./processors/registry", () => ({
  processJob: (job: unknown) => mockProcessJob(job),
}));

vi.mock("./queue", async () => {
  const actual: TQueueModule = await vi.importActual("./queue");

  return {
    ...actual,
    createJobsQueue: (options: unknown) => mockCreateJobsQueue(options),
  };
});

vi.mock("bullmq", () => ({
  Queue: vi.fn(),
  Worker: function MockWorker(queueName: string, processor: unknown, options?: unknown) {
    return mockWorkerConstructor(queueName, processor, options);
  },
}));

describe("@formbricks/jobs runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    producerConnection = createMockRedisConnection();
    queueMock = createMockQueue();
    workerConnections = [];
    workerMocks = [];
  });

  test("starts a worker with the expected queue, prefix, and processor bridge", async () => {
    const runtime = await startJobsRuntime({ redisUrl: "redis://localhost:6379" });

    expect(runtime.workers).toHaveLength(1);
    expect(mockWorkerConstructor).toHaveBeenCalledWith(
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 1,
        prefix: JOBS_PREFIX,
      })
    );

    const worker = workerMocks[0];
    expect(worker.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(worker.on).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(worker.on).toHaveBeenCalledWith("completed", expect.any(Function));

    const processor = mockWorkerConstructor.mock.calls[0]?.[1] as (job: unknown) => Promise<void>;
    const job = {
      attemptsMade: 1,
      id: "job-1",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    };
    await processor(job);

    expect(mockProcessJob).toHaveBeenCalledWith(job);

    const registeredWorkerEvents = new Map<string, (...args: unknown[]) => void>(
      worker.on.mock.calls.map(([event, handler]) => [event, handler as (...args: unknown[]) => void])
    );
    const workerError = new Error("worker error");
    const failedError = new Error("job failed");

    registeredWorkerEvents.get("error")?.(workerError);
    registeredWorkerEvents.get("failed")?.(
      {
        attemptsMade: 2,
        id: "job-2",
        name: JOB_NAMES.testLog,
        queueName: JOBS_QUEUE_NAME,
      },
      failedError
    );
    registeredWorkerEvents.get("completed")?.({
      attemptsMade: 1,
      id: "job-3",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: workerError, queueName: JOBS_QUEUE_NAME, workerNumber: 1 },
      "BullMQ worker error"
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptsMade: 2,
        err: failedError,
        jobId: "job-2",
        jobName: JOB_NAMES.testLog,
        queueName: JOBS_QUEUE_NAME,
        workerNumber: 1,
      }),
      "BullMQ job failed"
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      {
        attemptsMade: 1,
        jobId: "job-3",
        jobName: JOB_NAMES.testLog,
        queueName: JOBS_QUEUE_NAME,
        workerNumber: 1,
      },
      "BullMQ job completed"
    );

    await runtime.close();

    expect(worker.close).toHaveBeenCalledTimes(1);
    expect(queueMock.close).toHaveBeenCalledTimes(1);
    expect(mockCloseRedisConnection).toHaveBeenCalledTimes(2);
  });

  test("starts multiple workers when configured", async () => {
    const runtime = await startJobsRuntime({
      redisUrl: "redis://localhost:6379",
      concurrency: 4,
      workerCount: 2,
    });

    expect(runtime.workers).toHaveLength(2);
    expect(mockWorkerConstructor).toHaveBeenCalledTimes(2);
    expect(mockWorkerConstructor).toHaveBeenNthCalledWith(
      1,
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 4,
        prefix: JOBS_PREFIX,
      })
    );
    expect(mockWorkerConstructor).toHaveBeenNthCalledWith(
      2,
      JOBS_QUEUE_NAME,
      expect.any(Function),
      expect.objectContaining({
        concurrency: 4,
        prefix: JOBS_PREFIX,
      })
    );

    await runtime.close();

    expect(workerMocks[0]?.close).toHaveBeenCalledTimes(1);
    expect(workerMocks[1]?.close).toHaveBeenCalledTimes(1);
  });

  test("rejects invalid runtime tuning values", async () => {
    await expect(startJobsRuntime({ redisUrl: "redis://localhost:6379", concurrency: 0 })).rejects.toThrow(
      "BullMQ worker concurrency must be a positive integer"
    );
    await expect(startJobsRuntime({ redisUrl: "redis://localhost:6379", workerCount: 0 })).rejects.toThrow(
      "BullMQ worker count must be a positive integer"
    );

    expect(mockWorkerConstructor).not.toHaveBeenCalled();
  });

  test("cleans up workers and connections when startup fails", async () => {
    const startupError = new Error("queue not ready");
    queueMock.waitUntilReady.mockRejectedValueOnce(startupError);

    await expect(startJobsRuntime({ redisUrl: "redis://localhost:6379", workerCount: 2 })).rejects.toThrow(
      "queue not ready"
    );

    expect(workerMocks).toHaveLength(2);
    expect(workerMocks[0]?.close).toHaveBeenCalledTimes(1);
    expect(workerMocks[1]?.close).toHaveBeenCalledTimes(1);
    expect(queueMock.close).toHaveBeenCalledTimes(1);
    expect(mockCloseRedisConnection).toHaveBeenCalledTimes(3);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err: startupError, queueName: JOBS_QUEUE_NAME, prefix: JOBS_PREFIX },
      "Failed to start BullMQ runtime"
    );
  });

  test("deduplicates concurrent close calls", async () => {
    const runtime = await startJobsRuntime({ redisUrl: "redis://localhost:6379" });

    await Promise.all([runtime.close(), runtime.close()]);

    expect(workerMocks[0]?.close).toHaveBeenCalledTimes(1);
    expect(queueMock.close).toHaveBeenCalledTimes(1);
    expect(mockCloseRedisConnection).toHaveBeenCalledTimes(2);
  });

  test("logs signal shutdown failures", async () => {
    const processOnceSpy = vi.spyOn(process, "once");
    await startJobsRuntime({ redisUrl: "redis://localhost:6379" });
    const sigtermRegistration = processOnceSpy.mock.calls.find(
      (call): call is ["SIGTERM", () => void] => call[0] === "SIGTERM"
    );

    expect(sigtermRegistration).toBeDefined();

    mockCloseRedisConnection.mockRejectedValueOnce(new Error("connection close failed"));

    sigtermRegistration?.[1]();

    await vi.waitFor(() => {
      const shutdownFailureCall = mockLogger.error.mock.calls.find(
        (call) => call[1] === "BullMQ shutdown failed in closeRuntime after SIGTERM"
      ) as [unknown, string] | undefined;

      expect(shutdownFailureCall).toBeDefined();
      const shutdownFailureContext = shutdownFailureCall?.[0] as { err?: unknown } | undefined;
      expect(shutdownFailureContext?.err).toBeInstanceOf(Error);
    });

    processOnceSpy.mockRestore();
  });
});
