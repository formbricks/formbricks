import { Queue } from "bullmq";
import type IORedis from "ioredis";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  JOBS_DEFAULT_JOB_OPTIONS,
  JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
  JOBS_PREFIX,
  JOBS_QUEUE_NAME,
  JOB_NAMES,
} from "./constants";
import {
  createJobsQueue,
  enqueueTestLogJob,
  getBackgroundJobProducer,
  getJobsQueue,
  resetJobsQueueFactory,
  scheduleTestLogJobAt,
  upsertRecurringTestLogJobSchedule,
} from "./queue";
import { getRecurringJobSchedulerId } from "./schedules";

const {
  mockCloseRedisConnection,
  mockLoggerError,
  mockQueueAdd,
  mockQueueClose,
  mockQueueUpsertJobScheduler,
  mockQueueWaitUntilReady,
} = vi.hoisted(() => ({
  mockCloseRedisConnection: vi.fn(),
  mockLoggerError: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockQueueClose: vi.fn(),
  mockQueueUpsertJobScheduler: vi.fn(),
  mockQueueWaitUntilReady: vi.fn(),
}));

const mockConnection = {
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  status: "ready",
} as unknown as IORedis;

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: mockLoggerError,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./connection", () => ({
  createProducerConnection: vi.fn(() => mockConnection),
  getRedisUrlFromEnv: vi.fn(() => "redis://localhost:6379"),
  closeRedisConnection: mockCloseRedisConnection.mockResolvedValue(undefined),
}));

vi.mock("bullmq", () => ({
  Queue: vi.fn(function MockQueue() {
    mockQueueWaitUntilReady.mockResolvedValue(undefined);

    return {
      add: mockQueueAdd,
      close: mockQueueClose,
      upsertJobScheduler: mockQueueUpsertJobScheduler,
      waitUntilReady: mockQueueWaitUntilReady,
    };
  }),
}));

describe("@formbricks/jobs queue helpers", () => {
  beforeEach(async () => {
    await resetJobsQueueFactory();
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-07T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("creates the shared queue with the expected defaults", () => {
    createJobsQueue({ connection: mockConnection });

    expect(Queue).toHaveBeenCalledWith(
      JOBS_QUEUE_NAME,
      expect.objectContaining({
        connection: mockConnection,
        defaultJobOptions: JOBS_DEFAULT_JOB_OPTIONS,
        prefix: JOBS_PREFIX,
      })
    );
  });

  test("memoizes the producer queue", async () => {
    const first = await getJobsQueue();
    const second = await getJobsQueue();

    expect(first.queue).toBe(second.queue);
    expect(Queue).toHaveBeenCalledTimes(1);
  });

  test("enqueues the test log job with the shared queue", async () => {
    const mockJob = { id: "job-1" };
    mockQueueAdd.mockResolvedValue(mockJob);

    const job = await enqueueTestLogJob({ message: "hello world" });

    expect(job).toBe(mockJob);
    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.testLog, { message: "hello world" }, undefined);
  });

  test("exposes an engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: "job-2",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    const job = await producer.enqueueTestLog({ message: "hello interface" });

    expect(job).toEqual({
      jobId: "job-2",
      jobName: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });
  });

  test("schedules a delayed job using the runAt schedule type", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-3" });

    await scheduleTestLogJobAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      { message: "hello delayed world" }
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(
      JOB_NAMES.testLog,
      { message: "hello delayed world" },
      { delay: 5000 }
    );
  });

  test("upserts a recurring scheduler using engine-neutral schedule types", async () => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-4",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    await upsertRecurringTestLogJobSchedule(
      {
        scheduleId: "nightly-test-log",
        scope: "environment_123",
      },
      {
        cronPattern: "0 2 * * *",
        kind: "cron",
        timeZone: "UTC",
      },
      { message: "hello recurring world" }
    );

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      getRecurringJobSchedulerId(JOB_NAMES.testLog, {
        scheduleId: "nightly-test-log",
        scope: "environment_123",
      }),
      {
        endDate: undefined,
        immediately: undefined,
        limit: undefined,
        pattern: "0 2 * * *",
        startDate: undefined,
        tz: "UTC",
      },
      {
        data: { message: "hello recurring world" },
        name: JOB_NAMES.testLog,
        opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
      }
    );
  });

  test("exposes scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-5",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    const job = await producer.upsertRecurringTestLogSchedule(
      {
        scheduleId: "interface-recurring",
        scope: "organization_123",
      },
      {
        everyMs: 60_000,
        kind: "every",
      },
      { message: "hello scheduled interface" }
    );

    expect(job).toEqual({
      jobId: "job-5",
      jobName: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
      scheduleId: "interface-recurring",
      scope: "organization_123",
    });
  });

  test("cleans up producer resources when queue initialization fails", async () => {
    mockQueueWaitUntilReady.mockRejectedValueOnce(new Error("redis unavailable"));

    await expect(getJobsQueue()).rejects.toThrow("redis unavailable");

    expect(mockQueueClose).toHaveBeenCalledTimes(1);
    expect(mockCloseRedisConnection).toHaveBeenCalledWith(mockConnection);
  });

  test("keeps cleaning up when queue shutdown fails during reset", async () => {
    await getJobsQueue();
    mockQueueClose.mockRejectedValueOnce(new Error("queue close failed"));

    await expect(resetJobsQueueFactory()).resolves.toBeUndefined();

    expect(mockQueueClose).toHaveBeenCalledTimes(1);
    expect(mockCloseRedisConnection).toHaveBeenCalledWith(mockConnection);
    expect(mockLoggerError).toHaveBeenCalledTimes(1);
    const [context, message] = mockLoggerError.mock.calls[0] as [{ err: Error }, string];
    expect(context.err).toBeInstanceOf(Error);
    expect(message).toBe("Failed to close BullMQ producer queue during reset");
  });
});
