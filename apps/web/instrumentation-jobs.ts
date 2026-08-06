import { type JobHandlerOverrides, type JobsRuntimeHandle, startJobsRuntime } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { getJobsQueueingConfig, getJobsWorkerBootstrapConfig } from "@/lib/jobs/config";
import { RECURRING_JOB_REGISTRATIONS, getJobHandlerOverrides } from "@/lib/jobs/recurring-registrations";

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

/**
 * Upsert only — never remove first. `upsertJobScheduler` updates an existing scheduler's repeat options
 * in place (including switching between cron and every), so a remove is unnecessary; it is also harmful.
 * Removing and re-upserting in close succession can leave the scheduler with **no** delayed job at all
 * (bullmq#3063: the upsert finds a job already holding the expected id, but that job is already
 * completed), so the schedule reports a correct next run and never fires again. It also opens a window
 * with no schedule, which a crash between the two calls makes permanent until the next boot.
 *
 * The remove-first this replaces was a reasonable workaround for bullmq#3378 — upsert not updating an
 * existing scheduler — which affected v5.56.9 and earlier. We are on 5.61.0, past that fix.
 *
 * Known trade-off, verified against a real Redis: upsert updates the scheduler's repeat options but
 * leaves the run it has already queued alone, so a changed cron pattern or time zone takes effect from
 * the *next* iteration — up to 24h later for the daily sweeps, 3 minutes for the reconciler. The
 * remove-first moved that pending run immediately. That is the price of never leaving the schedule
 * without a queued run, and it is the right way round: a config change landing one cycle late is
 * recoverable, a schedule that silently stops firing is not.
 */
const registerRecurringJobSchedules = async (): Promise<void> => {
  for (const registration of RECURRING_JOB_REGISTRATIONS) {
    await registration.job.upsert(registration.schedule);
  }
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
    await registerRecurringJobSchedules();
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
  // The app's handlers win over anything the bootstrap config supplied.
  const jobHandlerOverrides: JobHandlerOverrides = {
    ...runtimeOptions.jobHandlerOverrides,
    ...getJobHandlerOverrides(),
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
