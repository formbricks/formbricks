import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockStartJobsRuntime = vi.fn();
const mockRemoveSurveyScheduling = vi.fn();
const mockUpsertSurveyScheduling = vi.fn();
const mockRemoveSurveyArchivePurge = vi.fn();
const mockUpsertSurveyArchivePurge = vi.fn();
const mockRemoveWorkflowRunReconcile = vi.fn();
const mockUpsertWorkflowRunReconcile = vi.fn();
const mockDebug = vi.fn();
const mockError = vi.fn();
const mockWarn = vi.fn();
const mockGetJobsQueueingConfig = vi.fn();
const mockGetJobsWorkerBootstrapConfig = vi.fn();
const mockProcessResponsePipelineJob = vi.fn();
const mockProcessSurveySchedulingJob = vi.fn();
const mockProcessSurveyArchivePurgeJob = vi.fn();
const mockProcessWorkflowRunJob = vi.fn();
const mockProcessWorkflowRunReconcileJob = vi.fn();
const TEST_TIMEOUT_MS = 15_000;

const slowTest = (name: string, fn: () => Promise<void>): void => {
  test(name, fn, TEST_TIMEOUT_MS);
};

// Only the queue calls are stubbed: `lib/jobs/recurring-registrations` runs for real against these
// handles, so the env-derived timing it pairs with each job stays under test.
vi.mock("@formbricks/jobs", () => ({
  ONE_SHOT_JOB_NAMES: {
    responsePipeline: "response-pipeline.process",
    workflowRun: "workflow-run.process",
  },
  recurringJobs: {
    surveyArchivePurge: {
      name: "survey-archive-purge.process",
      remove: mockRemoveSurveyArchivePurge,
      scheduleId: "daily-survey-archive-purge",
      scope: "global",
      upsert: mockUpsertSurveyArchivePurge,
    },
    surveyScheduling: {
      name: "survey-scheduling.reconcile",
      remove: mockRemoveSurveyScheduling,
      scheduleId: "daily-survey-scheduling",
      scope: "global",
      upsert: mockUpsertSurveyScheduling,
    },
    workflowRunReconcile: {
      name: "workflow-run.reconcile",
      remove: mockRemoveWorkflowRunReconcile,
      scheduleId: "workflow-run-reconcile",
      scope: "global",
      upsert: mockUpsertWorkflowRunReconcile,
    },
  },
  startJobsRuntime: mockStartJobsRuntime,
}));

vi.mock("@/lib/jobs/config", () => ({
  getJobsQueueingConfig: mockGetJobsQueueingConfig,
  getJobsWorkerBootstrapConfig: mockGetJobsWorkerBootstrapConfig,
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    debug: mockDebug,
    error: mockError,
    info: vi.fn(),
    warn: mockWarn,
  },
}));

vi.mock("@/modules/response-pipeline/lib/process-response-pipeline-job", () => ({
  processResponsePipelineJob: mockProcessResponsePipelineJob,
}));

vi.mock("@/modules/survey/scheduling/lib/process-survey-scheduling-job", () => ({
  processSurveySchedulingJob: mockProcessSurveySchedulingJob,
}));

vi.mock("@/modules/survey/archive/lib/process-survey-archive-purge-job", () => ({
  processSurveyArchivePurgeJob: mockProcessSurveyArchivePurgeJob,
}));

vi.mock("@/modules/ee/workflows/lib/runner/process-workflow-run-job", () => ({
  processWorkflowRunJob: mockProcessWorkflowRunJob,
}));

vi.mock("@/modules/ee/workflows/lib/runner/process-workflow-run-reconcile-job", () => ({
  processWorkflowRunReconcileJob: mockProcessWorkflowRunReconcileJob,
}));

describe("instrumentation-jobs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRemoveSurveyScheduling.mockResolvedValue(true);
    mockRemoveSurveyArchivePurge.mockResolvedValue(true);
    mockUpsertSurveyArchivePurge.mockResolvedValue({
      id: "archive-purge-schedule-1",
      name: "survey-archive-purge.process",
      queueName: "background-jobs",
    });
    mockRemoveWorkflowRunReconcile.mockResolvedValue(true);
    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: false,
      redisUrl: null,
    });
  });

  afterEach(async () => {
    const { resetJobsWorkerRegistrationForTests } = await import("./instrumentation-jobs");
    await resetJobsWorkerRegistrationForTests();
    vi.useRealTimers();
  });

  /**
   * Keying the registrations by `TRecurringJobKey` forces an entry to exist for every declared job, but
   * not that the entry holds *that* job's handle — a mispairing type-checks. It would be worse than a
   * swap: both entries would upsert the same scheduler, so one job's schedule is never registered and
   * its handler binds to the wrong name.
   */
  test("each recurring registration is paired with its own job handle", async () => {
    const { RECURRING_JOB_REGISTRATIONS_BY_KEY } = await import("@/lib/jobs/recurring-registrations");
    const { recurringJobs } = await import("@formbricks/jobs");

    for (const [key, registration] of Object.entries(RECURRING_JOB_REGISTRATIONS_BY_KEY)) {
      expect(registration.job, `registration "${key}" holds another job's handle`).toBe(
        recurringJobs[key as keyof typeof recurringJobs]
      );
    }
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
    expect(mockUpsertSurveyScheduling).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith("BullMQ worker startup skipped");
  });

  slowTest("starts the worker once and registers handlers", async () => {
    const mockRuntime = {
      close: vi.fn().mockResolvedValue(undefined),
    };
    const mockExistingOverride = vi.fn();

    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: true,
      runtimeOptions: {
        concurrency: 4,
        jobHandlerOverrides: {
          "test-log.process": mockExistingOverride,
        },
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
      jobHandlerOverrides: {
        "response-pipeline.process": expect.any(Function),
        "survey-scheduling.reconcile": expect.any(Function),
        "survey-archive-purge.process": expect.any(Function),
        "workflow-run.process": expect.any(Function),
        "test-log.process": mockExistingOverride,
        "workflow-run.reconcile": expect.any(Function),
      },
      redisUrl: "redis://localhost:6379",
      workerCount: 2,
    });
    const overrides = mockStartJobsRuntime.mock.calls[0]?.[0]?.jobHandlerOverrides;
    const responsePipelineOverride = overrides?.["response-pipeline.process"];
    const surveySchedulingOverride = overrides?.["survey-scheduling.reconcile"];
    const workflowRunOverride = overrides?.["workflow-run.process"];

    await responsePipelineOverride?.(
      {
        workspaceId: "ws_123",
        event: "responseCreated",
        response: { id: "res_123" },
        surveyId: "survey_123",
      },
      {
        attempt: 1,
        jobId: "job_123",
        jobName: "response-pipeline.process",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
    await surveySchedulingOverride?.(
      {
        scope: "global",
      },
      {
        attempt: 1,
        jobId: "job_456",
        jobName: "survey-scheduling.reconcile",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
    await workflowRunOverride?.(
      {
        workflowRunId: "run_123",
        workflowId: "wf_123",
        workspaceId: "ws_123",
      },
      {
        attempt: 1,
        jobId: "job_789",
        jobName: "workflow-run.process",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );

    expect(mockProcessResponsePipelineJob).toHaveBeenCalledWith(
      {
        workspaceId: "ws_123",
        event: "responseCreated",
        response: { id: "res_123" },
        surveyId: "survey_123",
      },
      {
        attempt: 1,
        jobId: "job_123",
        jobName: "response-pipeline.process",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
    expect(mockProcessSurveySchedulingJob).toHaveBeenCalledWith(
      {
        scope: "global",
      },
      {
        attempt: 1,
        jobId: "job_456",
        jobName: "survey-scheduling.reconcile",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );

    const workflowRunReconcileOverride = overrides?.["workflow-run.reconcile"];
    await workflowRunReconcileOverride?.(
      { scope: "global" },
      {
        attempt: 1,
        jobId: "job_789",
        jobName: "workflow-run.reconcile",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
    expect(mockProcessWorkflowRunJob).toHaveBeenCalledWith(
      {
        workflowRunId: "run_123",
        workflowId: "wf_123",
        workspaceId: "ws_123",
      },
      {
        attempt: 1,
        jobId: "job_789",
        jobName: "workflow-run.process",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
    expect(mockProcessWorkflowRunReconcileJob).toHaveBeenCalledWith(
      { scope: "global" },
      {
        attempt: 1,
        jobId: "job_789",
        jobName: "workflow-run.reconcile",
        maxAttempts: 3,
        queueName: "background-jobs",
      }
    );
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
    expect(mockWarn).toHaveBeenCalledWith(
      { retryDelayMs: 30_000 },
      "BullMQ worker registration retry scheduled"
    );
  });

  slowTest("retries worker startup after a transient failure", async () => {
    const startupError = new Error("startup failed");
    const recoveredRuntime = {
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

    mockStartJobsRuntime.mockRejectedValueOnce(startupError).mockResolvedValueOnce(recoveredRuntime);
    const { registerJobsWorker } = await import("./instrumentation-jobs");

    await expect(registerJobsWorker()).rejects.toThrow("startup failed");

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockStartJobsRuntime).toHaveBeenCalledTimes(2);
    await expect(registerJobsWorker()).resolves.toBe(recoveredRuntime);
  });

  slowTest(
    "registers recurring schedules once when queueing is enabled without an in-process worker",
    async () => {
      mockGetJobsQueueingConfig.mockReturnValue({
        enabled: true,
        redisUrl: "redis://localhost:6379",
      });
      mockGetJobsWorkerBootstrapConfig.mockReturnValue({
        enabled: false,
        runtimeOptions: null,
      });
      mockUpsertSurveyScheduling.mockResolvedValue({
        id: "schedule-job-1",
        name: "survey-scheduling.reconcile",
        queueName: "background-jobs",
      });
      mockUpsertWorkflowRunReconcile.mockResolvedValue({
        id: "schedule-job-2",
        name: "workflow-run.reconcile",
        queueName: "background-jobs",
      });

      const { registerRecurringJobs } = await import("./instrumentation-jobs");
      const { SURVEY_SCHEDULING_DAILY_CRON_PATTERN, SURVEY_SCHEDULING_TIME_ZONE } =
        await import("@/modules/survey/scheduling/lib/constants");
      const { SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN, SURVEY_ARCHIVE_PURGE_TIME_ZONE } =
        await import("@/modules/survey/archive/lib/constants");
      const { WORKFLOW_RUN_RECONCILE_INTERVAL_MS } =
        await import("@/modules/ee/workflows/lib/runner/reconcile-constants");

      await registerRecurringJobs();
      await registerRecurringJobs();

      // The schedule identity and payload now belong to the job declaration in @formbricks/jobs (and are
      // asserted there); what this app owns, and what is asserted here, is the timing per job.
      expect(mockStartJobsRuntime).not.toHaveBeenCalled();
      expect(mockUpsertSurveyScheduling).toHaveBeenCalledTimes(1);
      expect(mockUpsertSurveyScheduling).toHaveBeenCalledWith({
        cronPattern: SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
        kind: "cron",
        timeZone: SURVEY_SCHEDULING_TIME_ZONE,
      });
      expect(mockUpsertSurveyArchivePurge).toHaveBeenCalledTimes(1);
      expect(mockUpsertSurveyArchivePurge).toHaveBeenCalledWith({
        cronPattern: SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
        kind: "cron",
        timeZone: SURVEY_ARCHIVE_PURGE_TIME_ZONE,
      });
      // The purge is offset from scheduling but must run in the same zone. It used to read a
      // NEXT_PUBLIC_ var that ENG-1665 renamed away, pinning it to the Europe/Berlin fallback
      // regardless of configuration (ENG-2244).
      expect(SURVEY_ARCHIVE_PURGE_TIME_ZONE).toBe(SURVEY_SCHEDULING_TIME_ZONE);
      expect(mockUpsertWorkflowRunReconcile).toHaveBeenCalledTimes(1);
      expect(mockUpsertWorkflowRunReconcile).toHaveBeenCalledWith({
        everyMs: WORKFLOW_RUN_RECONCILE_INTERVAL_MS,
        kind: "every",
      });
      // Upsert is idempotent and updates repeat options in place; removing first risks leaving the
      // scheduler with no delayed job (bullmq#3063).
      expect(mockRemoveSurveyScheduling).not.toHaveBeenCalled();
      expect(mockRemoveSurveyArchivePurge).not.toHaveBeenCalled();
      expect(mockRemoveWorkflowRunReconcile).not.toHaveBeenCalled();
    }
  );

  slowTest("retries recurring schedule registration after a transient failure", async () => {
    const scheduleError = new Error("schedule failed");

    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockUpsertSurveyScheduling.mockRejectedValueOnce(scheduleError).mockResolvedValueOnce({
      id: "schedule-job-1",
      name: "survey-scheduling.reconcile",
      queueName: "background-jobs",
    });

    const { registerRecurringJobs } = await import("./instrumentation-jobs");

    await expect(registerRecurringJobs()).rejects.toThrow("schedule failed");
    expect(mockError).toHaveBeenCalledWith(
      { err: scheduleError },
      "BullMQ recurring job registration failed"
    );
    expect(mockWarn).toHaveBeenCalledWith(
      { retryDelayMs: 30_000 },
      "BullMQ recurring job registration retry scheduled"
    );

    await vi.advanceTimersByTimeAsync(30_000);

    expect(mockUpsertSurveyScheduling).toHaveBeenCalledTimes(2);
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
    await expect(resetJobsWorkerRegistrationForTests()).resolves.toBeUndefined();
    await expect(registerJobsWorker()).resolves.toBe(nextRuntime);

    expect(mockStartJobsRuntime).toHaveBeenCalledTimes(2);
    expect(mockError).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "BullMQ worker test reset close failed"
    );
  });
});
