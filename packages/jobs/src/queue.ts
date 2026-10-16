import { type Job, type JobsOptions, Queue } from "bullmq";
import type IORedis from "ioredis";
import { logger } from "@formbricks/logger";
import { closeRedisConnection, createProducerConnection, getRedisUrlFromEnv } from "@/src/connection";
import {
  JOBS_DEFAULT_JOB_OPTIONS,
  JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
  JOBS_PREFIX,
  JOBS_QUEUE_NAME,
  JOBS_QUEUE_NAMES,
  JOB_NAMES,
  type TJobsQueueName,
  WEBHOOK_DELIVERY_JOB_OPTIONS,
} from "@/src/constants";
import type { AnyBackgroundJobDefinition, BackgroundJobProducer, EnqueuedJob } from "@/src/contracts";
import { getBackgroundJobDefinition } from "@/src/definitions";
import { type RecurringJobDescriptor, type TRecurringJobKey, recurringJobDescriptors } from "@/src/recurring";
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
  type TWebhookDeliveryJobData,
  type TWorkflowRunJobData,
} from "@/src/types";

export interface JobsQueueHandle {
  connection: IORedis;
  queue: Queue;
}

/** Every queue the producer can address, sharing one Redis connection. */
interface JobsProducerHandle {
  connection: IORedis;
  queues: Readonly<Record<TJobsQueueName, Queue>>;
}

interface TGlobalJobsQueueState {
  formbricksJobsProducer: JobsProducerHandle | undefined;
  formbricksJobsProducerInitializing: Promise<JobsProducerHandle> | undefined;
}

// On globalThis rather than module scope so a module instantiated twice (Next.js dev reloads, separate
// server bundles) still shares one producer connection.
const globalForJobsQueue = globalThis as unknown as TGlobalJobsQueueState;

const hasActiveConnection = (connection?: IORedis): connection is IORedis =>
  connection !== undefined && connection.status !== "end";

export const createJobsQueue = ({
  connection,
  prefix = JOBS_PREFIX,
  queueName = JOBS_QUEUE_NAME,
}: {
  connection: IORedis;
  prefix?: string;
  queueName?: TJobsQueueName;
}): Queue => {
  const queue = new Queue(queueName, {
    connection,
    defaultJobOptions: JOBS_DEFAULT_JOB_OPTIONS,
    prefix,
  });

  // BullMQ's guide asks for an error handler on both the Worker and the Queue (the worker's lives in
  // runtime.ts). Without one, an emitted 'error' is an unhandled EventEmitter error and takes the
  // process down.
  queue.on("error", (error) => {
    logger.error({ err: error, queueName, prefix }, "BullMQ queue error");
  });

  return queue;
};

/** One `Queue` per known queue name, all on the given connection. */
export const createJobsQueues = ({
  connection,
  prefix = JOBS_PREFIX,
}: {
  connection: IORedis;
  prefix?: string;
}): Readonly<Record<TJobsQueueName, Queue>> =>
  Object.fromEntries(
    JOBS_QUEUE_NAMES.map((queueName) => [queueName, createJobsQueue({ connection, prefix, queueName })])
  ) as Record<TJobsQueueName, Queue>;

const closeJobsQueues = async (queues: Readonly<Record<TJobsQueueName, Queue>>): Promise<void> => {
  await Promise.all(
    Object.entries(queues).map(async ([queueName, queue]) => {
      try {
        await queue.close();
      } catch (error) {
        logger.error({ err: error, queueName }, "Failed to close BullMQ producer queue");
      }
    })
  );
};

const getJobsProducer = async (): Promise<JobsProducerHandle> => {
  const existing = globalForJobsQueue.formbricksJobsProducer;

  if (existing && hasActiveConnection(existing.connection)) {
    return existing;
  }

  if (globalForJobsQueue.formbricksJobsProducerInitializing) {
    return await globalForJobsQueue.formbricksJobsProducerInitializing;
  }

  globalForJobsQueue.formbricksJobsProducerInitializing = (async (): Promise<JobsProducerHandle> => {
    const connection = createProducerConnection({ redisUrl: getRedisUrlFromEnv() });
    const queues = createJobsQueues({ connection });

    try {
      await Promise.all(Object.values(queues).map((queue) => queue.waitUntilReady()));
    } catch (error) {
      try {
        await closeJobsQueues(queues);
      } finally {
        await closeRedisConnection(connection);
      }

      throw error;
    }

    const producer: JobsProducerHandle = { connection, queues };
    globalForJobsQueue.formbricksJobsProducer = producer;

    return producer;
  })();

  try {
    return await globalForJobsQueue.formbricksJobsProducerInitializing;
  } finally {
    globalForJobsQueue.formbricksJobsProducerInitializing = undefined;
  }
};

/** The producer queue for `queueName` — the default `background-jobs` unless a definition names another. */
export const getJobsQueue = async (queueName: TJobsQueueName = JOBS_QUEUE_NAME): Promise<JobsQueueHandle> => {
  const { connection, queues } = await getJobsProducer();

  return { connection, queue: queues[queueName] };
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
  const { queue } = await getJobsQueue(definition.queueName);
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
  const schedulerId = getRecurringJobSchedulerId(definition.name, identity);
  const { queue } = await getJobsQueue(definition.queueName);

  const scheduledJob = await queue.upsertJobScheduler(schedulerId, toBullMQRepeatOptions(schedule), {
    data: parsedData,
    name: definition.name,
    opts: JOBS_DEFAULT_JOB_SCHEDULER_TEMPLATE_OPTIONS,
  });

  await removeLegacyDefaultQueueSchedule(definition, schedulerId);

  return scheduledJob;
};

const removeRecurringBackgroundJobSchedule = async (
  jobName: string,
  identity: TBackgroundJobScheduleIdentity
): Promise<boolean> => {
  const definition = getBackgroundJobDefinition(jobName);

  if (!definition) {
    throw new Error(`No background job definition registered for job: ${jobName}`);
  }

  const schedulerId = getRecurringJobSchedulerId(definition.name, identity);
  const { queue } = await getJobsQueue(definition.queueName);
  const removed = await queue.removeJobScheduler(schedulerId);
  const removedLegacy = await removeLegacyDefaultQueueSchedule(definition, schedulerId);

  return removed || removedLegacy;
};

/**
 * Every recurring job used to live on the default queue. When a definition moves to a dedicated queue,
 * the scheduler the previous build left on `background-jobs` would otherwise keep firing there forever
 * — still queued behind the long jobs the move exists to escape. Removing it is idempotent (`false`
 * when there is nothing to remove) and also deletes the scheduler's pending delayed job, so the old
 * schedule stops producing work; a run already waiting completes once, harmlessly.
 *
 * Always called *after* the upsert on the dedicated queue, so the job is never left without a schedule.
 */
const removeLegacyDefaultQueueSchedule = async (
  definition: AnyBackgroundJobDefinition,
  schedulerId: string
): Promise<boolean> => {
  if (definition.queueName === JOBS_QUEUE_NAME) {
    return false;
  }

  const { queue: legacyQueue } = await getJobsQueue(JOBS_QUEUE_NAME);
  const removed = await legacyQueue.removeJobScheduler(schedulerId);

  if (removed) {
    logger.info(
      {
        jobName: definition.name,
        legacyQueueName: JOBS_QUEUE_NAME,
        queueName: definition.queueName,
        schedulerId,
      },
      "Removed legacy BullMQ schedule from the default queue"
    );
  }

  return removed;
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

export const enqueueWebhookDeliveryJob = async (
  data: TWebhookDeliveryJobData,
  options: { jobId: string }
): Promise<Job> => {
  try {
    // Per-job retry policy (see WEBHOOK_DELIVERY_JOB_OPTIONS) instead of the queue defaults: a single
    // endpoint's retries are its own budget. The jobId is mandatory and deterministic (derived by the
    // pipeline job from its own id + the webhookId), so a pipeline retry after a partial fan-out re-adds
    // only the children that were never enqueued — BullMQ treats an existing jobId as a no-op.
    return await enqueueBackgroundJob(JOB_NAMES.webhookDelivery, data, {
      ...WEBHOOK_DELIVERY_JOB_OPTIONS,
      jobId: options.jobId,
    });
  } catch (error) {
    logger.error(
      {
        err: error,
        event: data.event,
        jobName: JOB_NAMES.webhookDelivery,
        responseId: data.response.id,
        webhookId: data.webhookId,
        workspaceId: data.workspaceId,
      },
      "Failed to enqueue BullMQ webhook delivery job"
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
  webhookDelivery: JOB_NAMES.webhookDelivery,
  workflowRun: JOB_NAMES.workflowRun,
});

export const getBackgroundJobProducer = (): BackgroundJobProducer => ({
  enqueueResponsePipeline: async (data) => toEnqueuedJob(await enqueueResponsePipelineJob(data)),
});

export const resetJobsQueueFactory = async (): Promise<void> => {
  const producer = globalForJobsQueue.formbricksJobsProducer;

  globalForJobsQueue.formbricksJobsProducer = undefined;
  globalForJobsQueue.formbricksJobsProducerInitializing = undefined;

  if (!producer) {
    return;
  }

  await closeJobsQueues(producer.queues);

  try {
    await closeRedisConnection(producer.connection);
  } catch (error) {
    logger.error({ err: error }, "Failed to close BullMQ producer connection during reset");
  }
};
