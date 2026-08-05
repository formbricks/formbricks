import { type Job, type JobsOptions, Queue } from "bullmq";
import type IORedis from "ioredis";
import { logger } from "@formbricks/logger";
import { closeRedisConnection, createProducerConnection, getRedisUrlFromEnv } from "@/src/connection";
import {
  JOBS_DEFAULT_JOB_OPTIONS,
  JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
  JOBS_PREFIX,
  JOBS_QUEUE_NAME,
  JOB_NAMES,
} from "@/src/constants";
import type { BackgroundJobProducer, EnqueuedJob } from "@/src/contracts";
import { getBackgroundJobDefinition } from "@/src/definitions";
import {
  type RecurringJobDescriptor,
  type TRecurringJobKey,
  recurringJobDescriptors,
} from "@/src/recurring";
import {
  type TBackgroundJobScheduleIdentity,
  type TRecurringBackgroundJobSchedule,
  type TRunAtBackgroundJobSchedule,
  getDelayForRunAtSchedule,
  getRecurringJobSchedulerId,
  toBullMQRepeatOptions,
} from "@/src/schedules";
import {
  type TResponsePipelineJobData,
  type TTestLogJobData,
  type TWorkflowRunJobData,
} from "@/src/types";

export interface JobsQueueHandle {
  connection: IORedis;
  queue: Queue;
}

interface TGlobalJobsQueueState {
  formbricksJobsQueue: Queue | undefined;
  formbricksJobsProducerConnection: IORedis | undefined;
  formbricksJobsQueueInitializing: Promise<JobsQueueHandle> | undefined;
}

const globalForJobsQueue = globalThis as unknown as TGlobalJobsQueueState;

let queueSingleton = globalForJobsQueue.formbricksJobsQueue;
let connectionSingleton = globalForJobsQueue.formbricksJobsProducerConnection;

const hasActiveConnection = (connection?: IORedis): connection is IORedis =>
  connection !== undefined && connection.status !== "end";

export const createJobsQueue = ({
  connection,
  prefix = JOBS_PREFIX,
}: {
  connection: IORedis;
  prefix?: string;
}): Queue => {
  const queue = new Queue(JOBS_QUEUE_NAME, {
    connection,
    defaultJobOptions: JOBS_DEFAULT_JOB_OPTIONS,
    prefix,
  });

  // BullMQ's guide asks for an error handler on both the Worker and the Queue (the worker's lives in
  // runtime.ts). Without one, an emitted 'error' is an unhandled EventEmitter error and takes the
  // process down.
  queue.on("error", (error) => {
    logger.error({ err: error, queueName: JOBS_QUEUE_NAME, prefix }, "BullMQ queue error");
  });

  return queue;
};

export const getJobsQueue = async (): Promise<JobsQueueHandle> => {
  if (queueSingleton && hasActiveConnection(connectionSingleton)) {
    return {
      queue: queueSingleton,
      connection: connectionSingleton,
    };
  }

  if (
    globalForJobsQueue.formbricksJobsQueue &&
    hasActiveConnection(globalForJobsQueue.formbricksJobsProducerConnection)
  ) {
    queueSingleton = globalForJobsQueue.formbricksJobsQueue;
    connectionSingleton = globalForJobsQueue.formbricksJobsProducerConnection;

    return {
      queue: globalForJobsQueue.formbricksJobsQueue,
      connection: globalForJobsQueue.formbricksJobsProducerConnection,
    };
  }

  if (globalForJobsQueue.formbricksJobsQueueInitializing) {
    return await globalForJobsQueue.formbricksJobsQueueInitializing;
  }

  globalForJobsQueue.formbricksJobsQueueInitializing = (async (): Promise<JobsQueueHandle> => {
    const connection = createProducerConnection({ redisUrl: getRedisUrlFromEnv() });
    const queue = createJobsQueue({ connection });

    try {
      await queue.waitUntilReady();
    } catch (error) {
      try {
        await queue.close();
      } finally {
        await closeRedisConnection(connection);
      }

      throw error;
    }

    queueSingleton = queue;
    connectionSingleton = connection;
    globalForJobsQueue.formbricksJobsQueue = queue;
    globalForJobsQueue.formbricksJobsProducerConnection = connection;

    return {
      queue,
      connection,
    };
  })();

  try {
    return await globalForJobsQueue.formbricksJobsQueueInitializing;
  } finally {
    globalForJobsQueue.formbricksJobsQueueInitializing = undefined;
  }
};

const toEnqueuedJob = (
  job: Pick<Job, "name" | "queueName"> & {
    id?: Job["id"];
  }
): EnqueuedJob => {
  if (job.id === undefined) {
    throw new Error(`Missing BullMQ job.id in toEnqueuedJob for jobName=${job.name}`);
  }

  return {
    jobId: String(job.id),
    jobName: job.name,
    queueName: job.queueName,
  };
};

const enqueueBackgroundJob = async <TData>(
  jobName: string,
  data: TData,
  options?: JobsOptions
): Promise<Job> => {
  const definition = getBackgroundJobDefinition(jobName);

  if (!definition) {
    throw new Error(`No background job definition registered for job: ${jobName}`);
  }

  const parsedData = definition.schema.parse(data);
  const { queue } = await getJobsQueue();
  return await queue.add(definition.name, parsedData, options);
};

const scheduleBackgroundJobAt = async <TData>(
  jobName: string,
  schedule: TRunAtBackgroundJobSchedule,
  data: TData
): Promise<Job> => {
  const delay = getDelayForRunAtSchedule(schedule);

  return await enqueueBackgroundJob(jobName, data, { delay });
};

const upsertRecurringBackgroundJobSchedule = async <TData>(
  jobName: string,
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TData
): Promise<Job> => {
  const definition = getBackgroundJobDefinition(jobName);

  if (!definition) {
    throw new Error(`No background job definition registered for job: ${jobName}`);
  }

  const parsedData = definition.schema.parse(data);
  const { queue } = await getJobsQueue();

  return await queue.upsertJobScheduler(
    getRecurringJobSchedulerId(definition.name, identity),
    toBullMQRepeatOptions(schedule),
    {
      data: parsedData,
      name: definition.name,
      opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
    }
  );
};

const removeRecurringBackgroundJobSchedule = async (
  jobName: string,
  identity: TBackgroundJobScheduleIdentity
): Promise<boolean> => {
  const definition = getBackgroundJobDefinition(jobName);

  if (!definition) {
    throw new Error(`No background job definition registered for job: ${jobName}`);
  }

  const { queue } = await getJobsQueue();

  return await queue.removeJobScheduler(getRecurringJobSchedulerId(definition.name, identity));
};

export const enqueueTestLogJob = async (data: TTestLogJobData): Promise<Job> => {
  try {
    return await enqueueBackgroundJob(JOB_NAMES.testLog, data);
  } catch (error) {
    logger.error({ err: error, jobName: JOB_NAMES.testLog }, "Failed to enqueue BullMQ test log job");
    throw error;
  }
};

export const enqueueResponsePipelineJob = async (data: TResponsePipelineJobData): Promise<Job> => {
  try {
    return await enqueueBackgroundJob(JOB_NAMES.responsePipeline, data);
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.responsePipeline },
      "Failed to enqueue BullMQ response pipeline job"
    );
    throw error;
  }
};

export const enqueueWorkflowRunJob = async (
  data: TWorkflowRunJobData,
  options?: { jobId: string }
): Promise<Job> => {
  try {
    // Inherit the shared retry policy (attempts + backoff from the queue's defaultJobOptions): the
    // executor is idempotent per step (claim-before-send + @@unique([runId, stepId]), ENG-1228), so a
    // BullMQ retry resumes without re-sending. The deterministic jobId (the run id) keeps a re-enqueue
    // idempotent (no duplicate job) — e.g. when the reconciler re-dispatches an orphaned run.
    return await enqueueBackgroundJob(JOB_NAMES.workflowRun, data, {
      ...(options?.jobId ? { jobId: options.jobId } : {}),
    });
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.workflowRun, workflowRunId: data.workflowRunId },
      "Failed to enqueue BullMQ workflow run job"
    );
    throw error;
  }
};

export const scheduleTestLogJobAt = async (
  schedule: TRunAtBackgroundJobSchedule,
  data: TTestLogJobData
): Promise<Job> => {
  try {
    return await scheduleBackgroundJobAt(JOB_NAMES.testLog, schedule, data);
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.testLog, schedule },
      "Failed to schedule BullMQ test log job"
    );
    throw error;
  }
};

/**
 * Recurring smoke-test surface. `system.test-log` is the only job whose packaged handler actually runs
 * (the rest throw until the app registers an override), so this is the one path that can assert
 * end-to-end that a scheduler really produces work — see `jobs-integration.test.ts`.
 */
export const upsertRecurringTestLogJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TTestLogJobData
): Promise<Job> => {
  try {
    return await upsertRecurringBackgroundJobSchedule(JOB_NAMES.testLog, identity, schedule, data);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.testLog,
        schedule,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to upsert BullMQ test log schedule"
    );
    throw error;
  }
};

export interface RecurringJobHandle {
  readonly name: string;
  readonly scheduleId: string;
  readonly scope: string;
  remove: () => Promise<boolean>;
  upsert: (schedule: TRecurringBackgroundJobSchedule) => Promise<Job>;
}

const toRecurringJobHandle = (descriptor: RecurringJobDescriptor): RecurringJobHandle => {
  const identity = { scheduleId: descriptor.scheduleId, scope: descriptor.scope };
  // Built once from the descriptor so log field names cannot drift between recurring jobs.
  const logContext = {
    jobName: descriptor.name,
    scheduleId: descriptor.scheduleId,
    scope: descriptor.scope,
  };

  return {
    name: descriptor.name,
    scheduleId: descriptor.scheduleId,
    scope: descriptor.scope,
    remove: async () => {
      try {
        return await removeRecurringBackgroundJobSchedule(descriptor.name, identity);
      } catch (error) {
        logger.error({ ...logContext, err: error }, `Failed to remove BullMQ ${descriptor.label} schedule`);
        throw error;
      }
    },
    upsert: async (schedule) => {
      try {
        return await upsertRecurringBackgroundJobSchedule(
          descriptor.name,
          identity,
          schedule,
          descriptor.data
        );
      } catch (error) {
        logger.error(
          { ...logContext, err: error, schedule },
          `Failed to upsert BullMQ ${descriptor.label} schedule`
        );
        throw error;
      }
    },
  };
};

/**
 * Queue-bound handle per recurring job. The app registers a schedule through `upsert` and never spells
 * the job name itself: `name` also keys the worker's handler-override map, so a typo can no longer
 * leave a schedule firing against an unregistered override.
 */
export const recurringJobs = Object.freeze(
  Object.fromEntries(
    Object.entries(recurringJobDescriptors).map(([key, descriptor]) => [
      key,
      toRecurringJobHandle(descriptor),
    ])
  ) as Record<TRecurringJobKey, RecurringJobHandle>
);

/**
 * Names of the one-shot jobs whose real handler lives in `apps/web`. Exported so the app keys its
 * override map off this module instead of re-typing the strings; the JOB_NAMES registry stays internal.
 */
export const ONE_SHOT_JOB_NAMES = Object.freeze({
  responsePipeline: JOB_NAMES.responsePipeline,
  workflowRun: JOB_NAMES.workflowRun,
});

export const getBackgroundJobProducer = (): BackgroundJobProducer => ({
  enqueueResponsePipeline: async (data) => toEnqueuedJob(await enqueueResponsePipelineJob(data)),
});

export const resetJobsQueueFactory = async (): Promise<void> => {
  try {
    if (queueSingleton) {
      await queueSingleton.close();
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to close BullMQ producer queue during reset");
  }

  try {
    if (connectionSingleton) {
      await closeRedisConnection(connectionSingleton);
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to close BullMQ producer connection during reset");
  }

  queueSingleton = undefined;
  connectionSingleton = undefined;
  globalForJobsQueue.formbricksJobsQueue = undefined;
  globalForJobsQueue.formbricksJobsProducerConnection = undefined;
  globalForJobsQueue.formbricksJobsQueueInitializing = undefined;
};
