import {
  type JobHandlerOverrides,
  type JobsRuntimeHandle,
  type TResponsePipelineJobData,
  type TSurveyArchivePurgeJobData,
  type TSurveySchedulingJobData,
  removeRecurringSurveyArchivePurgeJobSchedule,
  removeRecurringSurveySchedulingJobSchedule,
  startJobsRuntime,
  upsertRecurringSurveyArchivePurgeJobSchedule,
  upsertRecurringSurveySchedulingJobSchedule,
} from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { processResponsePipelineJob } from "@/modules/response-pipeline/lib/process-response-pipeline-job";
import {
  SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
  SURVEY_ARCHIVE_PURGE_DAILY_SCHEDULE_ID,
  SURVEY_ARCHIVE_PURGE_GLOBAL_SCOPE,
  SURVEY_ARCHIVE_PURGE_TIME_ZONE,
} from "@/modules/survey/archive/lib/constants";
import { processSurveyArchivePurgeJob } from "@/modules/survey/archive/lib/process-survey-archive-purge-job";
import {
  SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
  SURVEY_SCHEDULING_DAILY_SCHEDULE_ID,
  SURVEY_SCHEDULING_GLOBAL_SCOPE,
  SURVEY_SCHEDULING_TIME_ZONE,
} from "@/modules/survey/scheduling/lib/constants";
import { processSurveySchedulingJob } from "@/modules/survey/scheduling/lib/process-survey-scheduling-job";

const WORKER_STARTUP_RETRY_DELAY_MS = 30_000;

type TJobsRuntimeGlobal = typeof globalThis & {
  formbricksJobsRecurringRegistration: Promise<void> | undefined;
  formbricksJobsRecurringRegistered: boolean | undefined;
  formbricksJobsRecurringRetryTimeout: ReturnType<typeof setTimeout> | undefined;
  formbricksJobsRuntime: JobsRuntimeHandle | undefined;
  formbricksJobsRuntimeInitializing: Promise<JobsRuntimeHandle> | undefined;
  formbricksJobsRuntimeRetryTimeout: ReturnType<typeof setTimeout> | undefined;
};

const globalForJobsRuntime = globalThis as TJobsRuntimeGlobal;
const RESPONSE_PIPELINE_JOB_NAME = "response-pipeline.process";
const SURVEY_SCHEDULING_JOB_NAME = "survey-scheduling.reconcile";
const SURVEY_ARCHIVE_PURGE_JOB_NAME = "survey-archive-purge.process";

const responsePipelineJobHandler: NonNullable<JobHandlerOverrides[string]> = async (data, context) => {
  await processResponsePipelineJob(data as TResponsePipelineJobData, context);
};
const surveySchedulingJobHandler: NonNullable<JobHandlerOverrides[string]> = async (data, context) => {
  await processSurveySchedulingJob(data as TSurveySchedulingJobData, context);
};
const surveyArchivePurgeJobHandler: NonNullable<JobHandlerOverrides[string]> = async (data, context) => {
  await processSurveyArchivePurgeJob(data as TSurveyArchivePurgeJobData, context);
};

const registerSurveySchedulingSchedule = async (): Promise<void> => {
  await removeRecurringSurveySchedulingJobSchedule({
    scheduleId: SURVEY_SCHEDULING_DAILY_SCHEDULE_ID,
    scope: SURVEY_SCHEDULING_GLOBAL_SCOPE,
  });

  await upsertRecurringSurveySchedulingJobSchedule(
    {
      scheduleId: SURVEY_SCHEDULING_DAILY_SCHEDULE_ID,
      scope: SURVEY_SCHEDULING_GLOBAL_SCOPE,
    },
    {
      cronPattern: SURVEY_SCHEDULING_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_SCHEDULING_TIME_ZONE,
    },
    {
      scope: SURVEY_SCHEDULING_GLOBAL_SCOPE,
    }
  );
};

const registerSurveyArchivePurgeSchedule = async (): Promise<void> => {
  await removeRecurringSurveyArchivePurgeJobSchedule({
    scheduleId: SURVEY_ARCHIVE_PURGE_DAILY_SCHEDULE_ID,
    scope: SURVEY_ARCHIVE_PURGE_GLOBAL_SCOPE,
  });

  await upsertRecurringSurveyArchivePurgeJobSchedule(
    {
      scheduleId: SURVEY_ARCHIVE_PURGE_DAILY_SCHEDULE_ID,
      scope: SURVEY_ARCHIVE_PURGE_GLOBAL_SCOPE,
    },
    {
      cronPattern: SURVEY_ARCHIVE_PURGE_DAILY_CRON_PATTERN,
      kind: "cron",
      timeZone: SURVEY_ARCHIVE_PURGE_TIME_ZONE,
    },
    {
      scope: SURVEY_ARCHIVE_PURGE_GLOBAL_SCOPE,
    }
  );
};

const clearRecurringJobsRetryTimeout = (): void => {
  if (globalForJobsRuntime.formbricksJobsRecurringRetryTimeout) {
    clearTimeout(globalForJobsRuntime.formbricksJobsRecurringRetryTimeout);
    globalForJobsRuntime.formbricksJobsRecurringRetryTimeout = undefined;
  }
};

const scheduleRecurringJobsRetry = (): void => {
  if (
    globalForJobsRuntime.formbricksJobsRecurringRegistered ||
    globalForJobsRuntime.formbricksJobsRecurringRegistration ||
    globalForJobsRuntime.formbricksJobsRecurringRetryTimeout
  ) {
    return;
  }

  globalForJobsRuntime.formbricksJobsRecurringRetryTimeout = setTimeout(() => {
    globalForJobsRuntime.formbricksJobsRecurringRetryTimeout = undefined;
    void registerRecurringJobs().catch(() => undefined);
  }, WORKER_STARTUP_RETRY_DELAY_MS);

  logger.warn(
    { retryDelayMs: WORKER_STARTUP_RETRY_DELAY_MS },
    "BullMQ recurring job registration retry scheduled"
  );
};

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

export const registerRecurringJobs = async (): Promise<void> => {
  const jobsQueueingConfig = getJobsQueueingConfig();

  if (!jobsQueueingConfig.enabled || !jobsQueueingConfig.redisUrl) {
    clearRecurringJobsRetryTimeout();
    logger.debug("BullMQ recurring job registration skipped");
    return;
  }

  if (globalForJobsRuntime.formbricksJobsRecurringRegistered) {
    return;
  }

  if (globalForJobsRuntime.formbricksJobsRecurringRegistration) {
    return await globalForJobsRuntime.formbricksJobsRecurringRegistration;
  }

  globalForJobsRuntime.formbricksJobsRecurringRegistration = (async () => {
    await registerSurveySchedulingSchedule();
    await registerSurveyArchivePurgeSchedule();
    clearRecurringJobsRetryTimeout();
    globalForJobsRuntime.formbricksJobsRecurringRegistered = true;
    globalForJobsRuntime.formbricksJobsRecurringRegistration = undefined;
  })();

  try {
    return await globalForJobsRuntime.formbricksJobsRecurringRegistration;
  } catch (error) {
    globalForJobsRuntime.formbricksJobsRecurringRegistration = undefined;
    logger.error({ err: error }, "BullMQ recurring job registration failed");
    scheduleRecurringJobsRetry();
    throw error;
  }
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

  const runtimeOptions = jobsWorkerBootstrapConfig.runtimeOptions;
  const jobHandlerOverrides: JobHandlerOverrides = runtimeOptions.jobHandlerOverrides
    ? {
        ...runtimeOptions.jobHandlerOverrides,
        [RESPONSE_PIPELINE_JOB_NAME]: responsePipelineJobHandler,
        [SURVEY_SCHEDULING_JOB_NAME]: surveySchedulingJobHandler,
        [SURVEY_ARCHIVE_PURGE_JOB_NAME]: surveyArchivePurgeJobHandler,
      }
    : {
        [RESPONSE_PIPELINE_JOB_NAME]: responsePipelineJobHandler,
        [SURVEY_SCHEDULING_JOB_NAME]: surveySchedulingJobHandler,
        [SURVEY_ARCHIVE_PURGE_JOB_NAME]: surveyArchivePurgeJobHandler,
      };

  globalForJobsRuntime.formbricksJobsRuntimeInitializing = (async () => {
    const runtime = await startJobsRuntime({
      ...runtimeOptions,
      jobHandlerOverrides,
    });

    clearJobsWorkerRetryTimeout();
    globalForJobsRuntime.formbricksJobsRuntime = runtime;
    globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;
    return runtime;
  })();

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
  const initializing = globalForJobsRuntime.formbricksJobsRuntimeInitializing;
  clearRecurringJobsRetryTimeout();
  clearJobsWorkerRetryTimeout();
  globalForJobsRuntime.formbricksJobsRecurringRegistered = undefined;
  globalForJobsRuntime.formbricksJobsRecurringRegistration = undefined;
  globalForJobsRuntime.formbricksJobsRuntime = undefined;
  globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;

  const runtimesToClose = new Set<JobsRuntimeHandle>();

  if (runtime) {
    runtimesToClose.add(runtime);
  }

  if (initializing) {
    try {
      const initializedRuntime = await initializing;
      runtimesToClose.add(initializedRuntime);
    } catch {
      // Startup failures are already surfaced by the test that triggered them.
    }
  }

  if (globalForJobsRuntime.formbricksJobsRuntime) {
    runtimesToClose.add(globalForJobsRuntime.formbricksJobsRuntime);
  }

  globalForJobsRuntime.formbricksJobsRuntime = undefined;
  globalForJobsRuntime.formbricksJobsRuntimeInitializing = undefined;

  await Promise.all(
    [...runtimesToClose].map(async (runtimeHandle) => {
      try {
        await runtimeHandle.close();
      } catch (error) {
        logger.error({ err: error }, "BullMQ worker test reset close failed");
      }
    })
  );
};
