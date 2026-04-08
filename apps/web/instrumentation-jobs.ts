import {
  JOB_NAMES,
  type JobsRuntimeHandle,
  type TResponsePipelineJobData,
  startJobsRuntime,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";

type TJobsRuntimeGlobal = typeof globalThis & {
  formbricksJobsRuntime: JobsRuntimeHandle | undefined;
  formbricksJobsRuntimeInitializing: Promise<JobsRuntimeHandle> | undefined;
};

const globalForJobsRuntime = globalThis as TJobsRuntimeGlobal;

export const registerJobsWorker = async (): Promise<JobsRuntimeHandle | null> => {
  const jobsWorkerBootstrapConfig = getJobsWorkerBootstrapConfig();

  if (!jobsWorkerBootstrapConfig.enabled || !jobsWorkerBootstrapConfig.runtimeOptions) {
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
      [JOB_NAMES.responsePipeline]: async (data, context) => {
        await processResponsePipelineJob(data as TResponsePipelineJobData, context);
      },
    },
  }).then((runtime) => {
    globalForJobsRuntime.formbricksJobsRuntime = runtime;
    globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;
    return runtime;
  });

  try {
    return await globalForJobsRuntime.formbricksJobsRuntimeInitializing;
  } catch (error) {
    globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;
    logger.error({ err: error }, "BullMQ worker registration failed");
    throw error;
  }
};

export const resetJobsWorkerRegistrationForTests = async (): Promise<void> => {
  const runtime = globalForJobsRuntime.formbricksJobsRuntime;
  globalForJobsRuntime.formbricksJobsRuntime = undefined;
  globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;

  if (runtime) {
    await runtime.close();
  }
};
