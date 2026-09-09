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
  enqueueResponsePipelineJob,
  enqueueTestLogJob,
  enqueueWorkflowRunJob,
  getBackgroundJobProducer,
  getJobsQueue,
  recurringJobs,
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
  mockQueueOn,
  mockQueueRemoveJobScheduler,
  mockQueueUpsertJobScheduler,
  mockQueueWaitUntilReady,
} = vi.hoisted(() => ({
  mockCloseRedisConnection: vi.fn(),
  mockLoggerError: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockQueueClose: vi.fn(),
  mockQueueOn: vi.fn(),
  mockQueueRemoveJobScheduler: vi.fn(),
  mockQueueUpsertJobScheduler: vi.fn(),
  mockQueueWaitUntilReady: vi.fn(),
}));

const mockConnection = {
  on: vi.fn(),
  quit: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  status: "ready",
} as unknown as IORedis;

const responsePipelineJobData = {
  workspaceId: "cm8cmpnjj000108jfdr9dfqe8",
  event: "responseCreated" as const,
  response: {
    contact: null,
    contactAttributes: null,
    createdAt: new Date("2026-04-07T10:00:00.000Z"),
    data: {},
    displayId: null,
    endingId: null,
    finished: false,
    id: "cm8cmpnjj000108jfdr9dfqe6",
    language: null,
    meta: {},
    singleUseId: null,
    surveyId: "cm8cmpnjj000108jfdr9dfqe7",
    tags: [],
    updatedAt: new Date("2026-04-07T10:00:00.000Z"),
    variables: {},
  },
  surveyId: "cm8cmpnjj000108jfdr9dfqe7",
};

const surveySchedulingJobData = {
  scope: "global" as const,
};

const workflowRunJobData = {
  workflowRunId: "cm8cmpnjj000108jfdr9wrun1",
  workflowId: "cm8cmpnjj000108jfdr9wflo1",
  workspaceId: "cm8cmpnjj000108jfdr9wksp1",
};

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
      on: mockQueueOn,
      removeJobScheduler: mockQueueRemoveJobScheduler,
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

  test("uses a Redis Cluster hash-tagged prefix for BullMQ keys", () => {
    expect(JOBS_PREFIX).toBe("{formbricks:jobs}");
  });

  // An unhandled 'error' event on the queue would otherwise take the process down.
  test("logs queue errors instead of leaving the event unhandled", () => {
    createJobsQueue({ connection: mockConnection });

    expect(mockQueueOn).toHaveBeenCalledWith("error", expect.any(Function));

    const errorListener = mockQueueOn.mock.calls.find((call) => call[0] === "error")?.[1] as (
      error: Error
    ) => void;
    const queueError = new Error("queue exploded");
    errorListener(queueError);

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: queueError, queueName: JOBS_QUEUE_NAME }),
      "BullMQ queue error"
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

  test("enqueues the response pipeline job with the shared queue", async () => {
    const mockJob = { id: "job-response-1" };
    mockQueueAdd.mockResolvedValue(mockJob);

    const job = await enqueueResponsePipelineJob(responsePipelineJobData);

    expect(job).toBe(mockJob);
    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.responsePipeline, responsePipelineJobData, undefined);
  });

  test("enqueues the workflow run job with a deterministic jobId and the shared retry policy", async () => {
    const mockJob = { id: "job-workflow-run-1" };
    mockQueueAdd.mockResolvedValue(mockJob);

    const job = await enqueueWorkflowRunJob(workflowRunJobData, { jobId: workflowRunJobData.workflowRunId });

    expect(job).toBe(mockJob);
    // No per-job attempts override: the job inherits attempts + backoff from the queue's
    // defaultJobOptions (retries are safe now that execution is idempotent per step — ENG-1228).
    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.workflowRun, workflowRunJobData, {
      jobId: workflowRunJobData.workflowRunId,
    });
  });

  test("exposes response pipeline enqueues through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: "job-response-1",
      name: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });

    const job = await producer.enqueueResponsePipeline(responsePipelineJobData);

    expect(job).toEqual({
      jobId: "job-response-1",
      jobName: JOB_NAMES.responsePipeline,
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

  test("upserts a recurring schedule through its handle using an every schedule", async () => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-reconcile-1",
      name: JOB_NAMES.workflowRunReconcile,
      queueName: JOBS_QUEUE_NAME,
    });

    await recurringJobs.workflowRunReconcile.upsert({ everyMs: 180_000, kind: "every" });

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      "workflow-run.reconcile:global:workflow-run-reconcile",
      { endDate: undefined, every: 180_000, limit: undefined, startDate: undefined },
      {
        data: { scope: "global" },
        name: JOB_NAMES.workflowRunReconcile,
        opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
      }
    );
  });

  test("upserts a recurring schedule through its handle using a cron schedule", async () => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-scheduling-1",
      name: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await recurringJobs.surveyScheduling.upsert({
      cronPattern: "0 0 * * *",
      kind: "cron",
      timeZone: "Etc/GMT-1",
    });

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      "survey-scheduling.reconcile:global:daily-survey-scheduling",
      {
        endDate: undefined,
        immediately: undefined,
        limit: undefined,
        pattern: "0 0 * * *",
        startDate: undefined,
        tz: "Etc/GMT-1",
      },
      {
        data: surveySchedulingJobData,
        name: JOB_NAMES.surveyScheduling,
        opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
      }
    );
    expect(scheduledJob.id).toBe("job-scheduling-1");
  });

  test("removes a recurring schedule using the identity it owns", async () => {
    mockQueueRemoveJobScheduler.mockResolvedValue(true);

    const removed = await recurringJobs.surveyScheduling.remove();

    expect(removed).toBe(true);
    expect(mockQueueRemoveJobScheduler).toHaveBeenCalledWith(
      "survey-scheduling.reconcile:global:daily-survey-scheduling"
    );
  });

  // These ids address schedules that already exist in production Redis. Changing one orphans the live
  // schedule instead of updating it, so they are pinned as literals here rather than derived.
  test.each([
    ["authzedProjectionDelivery", "authzed-projection.deliver:global:authzed-projection-delivery"],
    ["authzedReconciliationAudit", "authzed-reconciliation.audit:global:authzed-reconciliation-audit"],
    ["surveyArchivePurge", "survey-archive-purge.process:global:daily-survey-archive-purge"],
    ["surveyScheduling", "survey-scheduling.reconcile:global:daily-survey-scheduling"],
    ["usageTelemetry", "usage-telemetry.process:global:daily-usage-telemetry"],
    ["workflowRunReconcile", "workflow-run.reconcile:global:workflow-run-reconcile"],
  ] as const)("keeps the %s scheduler id stable", async (key, expectedSchedulerId) => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-id-parity",
      name: recurringJobs[key].name,
      queueName: JOBS_QUEUE_NAME,
    });

    await recurringJobs[key].upsert({ everyMs: 60_000, kind: "every" });

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      expectedSchedulerId,
      expect.anything(),
      expect.objectContaining({ name: recurringJobs[key].name })
    );
    expect(getRecurringJobSchedulerId(recurringJobs[key].name, recurringJobs[key])).toBe(expectedSchedulerId);
  });

  test("rejects engine-neutral enqueues when BullMQ returns a job without an id", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: undefined,
      name: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });

    await expect(producer.enqueueResponsePipeline(responsePipelineJobData)).rejects.toThrow(
      "Missing BullMQ job.id in toEnqueuedJob for jobName=response-pipeline.process"
    );
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
    const loggerCalls = mockLoggerError.mock.calls as [{ err: Error }, string][];
    const [context, message] = loggerCalls[0];
    expect(context.err).toBeInstanceOf(Error);
    expect(message).toBe("Failed to close BullMQ producer queue during reset");
  });

  test("clears memoized state after reset so a new queue can be created", async () => {
    await getJobsQueue();

    await resetJobsQueueFactory();
    const nextQueueResult = await getJobsQueue();

    expect(nextQueueResult.queue).toBeDefined();
    expect(Queue).toHaveBeenCalledTimes(2);
  });
});
