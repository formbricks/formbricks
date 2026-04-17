import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mockStartJobsRuntime = vi.fn();
const mockUpsertRecurringSurveySchedulingJobSchedule = vi.fn();
const mockDebug = vi.fn();
const mockError = vi.fn();
const mockWarn = vi.fn();
const mockGetJobsQueueingConfig = vi.fn();
const mockGetJobsWorkerBootstrapConfig = vi.fn();
const mockProcessResponsePipelineJob = vi.fn();
const mockProcessSurveySchedulingJob = vi.fn();
const TEST_TIMEOUT_MS = 15_000;

const slowTest = (name: string, fn: () => Promise<void>): void => {
  test(name, fn, TEST_TIMEOUT_MS);
};

vi.mock("@formbricks/jobs", () => ({
  startJobsRuntime: mockStartJobsRuntime,
  upsertRecurringSurveySchedulingJobSchedule: mockUpsertRecurringSurveySchedulingJobSchedule,
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

describe("instrumentation-jobs", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
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

  slowTest("skips worker startup when disabled", async () => {
    mockGetJobsWorkerBootstrapConfig.mockReturnValue({
      enabled: false,
      runtimeOptions: null,
    });

    const { registerJobsWorker } = await import("./instrumentation-jobs");
    const result = await registerJobsWorker();

    expect(result).toBeNull();
    expect(mockStartJobsRuntime).not.toHaveBeenCalled();
    expect(mockUpsertRecurringSurveySchedulingJobSchedule).not.toHaveBeenCalled();
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
        "test-log.process": mockExistingOverride,
      },
      redisUrl: "redis://localhost:6379",
      workerCount: 2,
    });
    const overrides = mockStartJobsRuntime.mock.calls[0]?.[0]?.jobHandlerOverrides;
    const responsePipelineOverride = overrides?.["response-pipeline.process"];
    const surveySchedulingOverride = overrides?.["survey-scheduling.reconcile"];

    await responsePipelineOverride?.(
      {
        environmentId: "env_123",
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

    expect(mockProcessResponsePipelineJob).toHaveBeenCalledWith(
      {
        environmentId: "env_123",
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
      mockUpsertRecurringSurveySchedulingJobSchedule.mockResolvedValue({
        id: "schedule-job-1",
        name: "survey-scheduling.reconcile",
        queueName: "background-jobs",
      });

      const { registerRecurringJobs } = await import("./instrumentation-jobs");

      await registerRecurringJobs();
      await registerRecurringJobs();

      expect(mockStartJobsRuntime).not.toHaveBeenCalled();
      expect(mockUpsertRecurringSurveySchedulingJobSchedule).toHaveBeenCalledTimes(1);
      expect(mockUpsertRecurringSurveySchedulingJobSchedule).toHaveBeenCalledWith(
        {
          scheduleId: "daily-survey-scheduling",
          scope: "global",
        },
        {
          cronPattern: "0 0 * * *",
          kind: "cron",
          timeZone: "Etc/GMT-1",
        },
        {
          scope: "global",
        }
      );
    }
  );

  slowTest("retries recurring schedule registration after a transient failure", async () => {
    const scheduleError = new Error("schedule failed");

    mockGetJobsQueueingConfig.mockReturnValue({
      enabled: true,
      redisUrl: "redis://localhost:6379",
    });
    mockUpsertRecurringSurveySchedulingJobSchedule
      .mockRejectedValueOnce(scheduleError)
      .mockResolvedValueOnce({
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

    expect(mockUpsertRecurringSurveySchedulingJobSchedule).toHaveBeenCalledTimes(2);
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
