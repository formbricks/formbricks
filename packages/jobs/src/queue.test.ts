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
  enqueueSurveySchedulingJob,
  enqueueTestLogJob,
  enqueueWorkflowRunJob,
  getBackgroundJobProducer,
  getJobsQueue,
  removeRecurringSurveySchedulingJobSchedule,
  resetJobsQueueFactory,
  scheduleResponsePipelineJobAt,
  scheduleSurveySchedulingJobAt,
  scheduleTestLogJobAt,
  upsertRecurringResponsePipelineJobSchedule,
  upsertRecurringSurveySchedulingJobSchedule,
  upsertRecurringTestLogJobSchedule,
} from "./queue";
import { getRecurringJobSchedulerId } from "./schedules";

const {
  mockCloseRedisConnection,
  mockLoggerError,
  mockQueueAdd,
  mockQueueClose,
  mockQueueRemoveJobScheduler,
  mockQueueUpsertJobScheduler,
  mockQueueWaitUntilReady,
} = vi.hoisted(() => ({
  mockCloseRedisConnection: vi.fn(),
  mockLoggerError: vi.fn(),
  mockQueueAdd: vi.fn(),
  mockQueueClose: vi.fn(),
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

  test("enqueues the survey scheduling job with the shared queue", async () => {
    const mockJob = { id: "job-scheduling-1" };
    mockQueueAdd.mockResolvedValue(mockJob);

    const job = await enqueueSurveySchedulingJob(surveySchedulingJobData);

    expect(job).toBe(mockJob);
    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.surveyScheduling, surveySchedulingJobData, undefined);
  });

  test("enqueues the workflow run job with attempts:1 and a deterministic jobId", async () => {
    const mockJob = { id: "job-workflow-run-1" };
    mockQueueAdd.mockResolvedValue(mockJob);

    const job = await enqueueWorkflowRunJob(workflowRunJobData, { jobId: workflowRunJobData.workflowRunId });

    expect(job).toBe(mockJob);
    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.workflowRun, workflowRunJobData, {
      attempts: 1,
      jobId: workflowRunJobData.workflowRunId,
    });
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

  test("schedules a delayed response pipeline job", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-response-2" });

    await scheduleResponsePipelineJobAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      responsePipelineJobData
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.responsePipeline, responsePipelineJobData, {
      delay: 5000,
    });
  });

  test("schedules a delayed survey scheduling job", async () => {
    mockQueueAdd.mockResolvedValue({ id: "job-scheduling-2" });

    await scheduleSurveySchedulingJobAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      surveySchedulingJobData
    );

    expect(mockQueueAdd).toHaveBeenCalledWith(JOB_NAMES.surveyScheduling, surveySchedulingJobData, {
      delay: 5000,
    });
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

  test("exposes response pipeline scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: "job-6",
      name: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await producer.scheduleResponsePipelineAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      responsePipelineJobData
    );

    expect(scheduledJob).toEqual({
      jobId: "job-6",
      jobName: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });
  });

  test("exposes survey scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: "job-6c",
      name: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await producer.scheduleSurveySchedulingAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      surveySchedulingJobData
    );

    expect(scheduledJob).toEqual({
      jobId: "job-6c",
      jobName: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
    });
  });

  test("exposes test log scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: "job-6b",
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await producer.scheduleTestLogAt(
      { runAt: new Date("2026-04-07T10:00:05.000Z") },
      { message: "scheduled through producer" }
    );

    expect(scheduledJob).toEqual({
      jobId: "job-6b",
      jobName: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });
  });

  test("upserts recurring response pipeline schedules", async () => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-7",
      name: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await upsertRecurringResponsePipelineJobSchedule(
      {
        scheduleId: "response-pipeline-recurring",
        scope: "environment_123",
      },
      {
        everyMs: 60_000,
        kind: "every",
      },
      responsePipelineJobData
    );

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      getRecurringJobSchedulerId(JOB_NAMES.responsePipeline, {
        scheduleId: "response-pipeline-recurring",
        scope: "environment_123",
      }),
      {
        endDate: undefined,
        every: 60_000,
        limit: undefined,
        startDate: undefined,
      },
      {
        data: responsePipelineJobData,
        name: JOB_NAMES.responsePipeline,
        opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
      }
    );
    expect(scheduledJob.id).toBe("job-7");
  });

  test("exposes recurring response pipeline scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-7b",
      name: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await producer.upsertRecurringResponsePipelineSchedule(
      {
        scheduleId: "response-pipeline-recurring-producer",
        scope: "environment_123",
      },
      {
        everyMs: 60_000,
        kind: "every",
      },
      responsePipelineJobData
    );

    expect(scheduledJob).toEqual({
      jobId: "job-7b",
      jobName: JOB_NAMES.responsePipeline,
      queueName: JOBS_QUEUE_NAME,
      scheduleId: "response-pipeline-recurring-producer",
      scope: "environment_123",
    });
  });

  test("upserts recurring survey scheduling schedules", async () => {
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-7c",
      name: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await upsertRecurringSurveySchedulingJobSchedule(
      {
        scheduleId: "daily-survey-scheduling",
        scope: "global",
      },
      {
        cronPattern: "0 0 * * *",
        kind: "cron",
        timeZone: "Etc/GMT-1",
      },
      surveySchedulingJobData
    );

    expect(mockQueueUpsertJobScheduler).toHaveBeenCalledWith(
      getRecurringJobSchedulerId(JOB_NAMES.surveyScheduling, {
        scheduleId: "daily-survey-scheduling",
        scope: "global",
      }),
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
    expect(scheduledJob.id).toBe("job-7c");
  });

  test("removes recurring survey scheduling schedules", async () => {
    mockQueueRemoveJobScheduler.mockResolvedValue(true);

    const removed = await removeRecurringSurveySchedulingJobSchedule({
      scheduleId: "daily-survey-scheduling",
      scope: "global",
    });

    expect(mockQueueRemoveJobScheduler).toHaveBeenCalledWith(
      getRecurringJobSchedulerId(JOB_NAMES.surveyScheduling, {
        scheduleId: "daily-survey-scheduling",
        scope: "global",
      })
    );
    expect(removed).toBe(true);
  });

  test("exposes recurring survey scheduling through the engine-neutral producer interface", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueUpsertJobScheduler.mockResolvedValue({
      id: "job-7d",
      name: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
    });

    const scheduledJob = await producer.upsertRecurringSurveySchedulingSchedule(
      {
        scheduleId: "daily-survey-scheduling",
        scope: "global",
      },
      {
        cronPattern: "0 0 * * *",
        kind: "cron",
        timeZone: "Etc/GMT-1",
      },
      surveySchedulingJobData
    );

    expect(scheduledJob).toEqual({
      jobId: "job-7d",
      jobName: JOB_NAMES.surveyScheduling,
      queueName: JOBS_QUEUE_NAME,
      scheduleId: "daily-survey-scheduling",
      scope: "global",
    });
  });

  test("rejects engine-neutral enqueues when BullMQ returns a job without an id", async () => {
    const producer = getBackgroundJobProducer();
    mockQueueAdd.mockResolvedValue({
      id: undefined,
      name: JOB_NAMES.testLog,
      queueName: JOBS_QUEUE_NAME,
    });

    await expect(producer.enqueueTestLog({ message: "missing id" })).rejects.toThrow(
      "Missing BullMQ job.id in toEnqueuedJob for jobName=system.test-log"
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
