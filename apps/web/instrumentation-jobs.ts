import { type JobsRuntimeHandle, type TResponsePipelineJobData, startJobsRuntime } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";

const WORKER_STARTUP_RETRY_DELAY_MS = 30_000;

type TJobsRuntimeGlobal = typeof globalThis & {
  formbricksJobsRuntime: JobsRuntimeHandle | undefined;
  formbricksJobsRuntimeInitializing: Promise<JobsRuntimeHandle> | undefined;
  formbricksJobsRuntimeRetryTimeout: ReturnType<typeof setTimeout> | undefined;
};

const globalForJobsRuntime = globalThis as TJobsRuntimeGlobal;
const RESPONSE_PIPELINE_JOB_NAME = "response-pipeline.process";

const clearJobsWorkerRetryTimeout = (): void => {
  if (globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout) {
    clearTimeout(globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout);
    globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout = undefined;
  }
};

const scheduleJobsWorkerRetry = (): void => {
  if (
    globalForJobsRuntime.formbricksJobsRuntime ||
    globalForJobsRuntime.formbricksJobsRuntimeInitializing ||
    globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout
  ) {
    return;
  }

  globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout = setTimeout(() => {
    globalForJobsRuntime.formbricksJobsRuntimeRetryTimeout = undefined;
    void registerJobsWorker().catch(() => undefined);
  }, WORKER_STARTUP_RETRY_DELAY_MS);

  logger.warn({ retryDelayMs: WORKER_STARTUP_RETRY_DELAY_MS }, "BullMQ worker registration retry scheduled");
};

export const registerJobsWorker = async (): Promise<JobsRuntimeHandle | null> => {
  const jobsWorkerBootstrapConfig = getJobsWorkerBootstrapConfig();

  if (!jobsWorkerBootstrapConfig.enabled || !jobsWorkerBootstrapConfig.runtimeOptions) {
    clearJobsWorkerRetryTimeout();
    logger.debug("BullMQ worker startup skipped");
    return null;
  }

  if (globalForJobsRuntime.formbricksJobsRuntime) {
    return globalForJobsRuntime.formbricksJobsRuntime;
  }

  if (globalForJobsRuntime.formbricksJobsRuntimeInitializing) {
    return await globalForJobsRuntime.formbricksJobsRuntimeInitializing;
  }

  globalForJobsRuntime.formbricksJobsRuntimeInitializing = startJobsRuntime({
    ...jobsWorkerBootstrapConfig.runtimeOptions,
    jobHandlerOverrides: {
      [RESPONSE_PIPELINE_JOB_NAME]: async (data, context) => {
        await processResponsePipelineJob(data as TResponsePipelineJobData, context);
      },
    },
  }).then((runtime) => {
    clearJobsWorkerRetryTimeout();
    globalForJobsRuntime.formbricksJobsRuntime = runtime;
    globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;
    return runtime;
  });

  try {
    return await globalForJobsRuntime.formbricksJobsRuntimeInitializing;
  } catch (error) {
    globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;
    logger.error({ err: error }, "BullMQ worker registration failed");
    scheduleJobsWorkerRetry();
    throw error;
  }
};

export const resetJobsWorkerRegistrationForTests = async (): Promise<void> => {
  const runtime = globalForJobsRuntime.formbricksJobsRuntime;
  clearJobsWorkerRetryTimeout();
  globalForJobsRuntime.formbricksJobsRuntime = undefined;
  globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;

  if (runtime) {
    await runtime.close();
  }
};
