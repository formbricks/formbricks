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
  type TBackgroundJobScheduleIdentity,
  type TRecurringBackgroundJobSchedule,
  type TRunAtBackgroundJobSchedule,
  getDelayForRunAtSchedule,
  getRecurringJobSchedulerId,
  toBullMQRepeatOptions,
} from "@/src/schedules";
import {
  type TResponsePipelineJobData,
  type TSurveyArchivePurgeJobData,
  type TSurveySchedulingJobData,
  type TTestLogJobData,
  type TWorkflowRunJobData,
  type TWorkflowRunReconcileJobData,
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
}): Queue =>
  new Queue(JOBS_QUEUE_NAME, {
    connection,
    defaultJobOptions: JOBS_DEFAULT_JOB_OPTIONS,
    prefix,
  });

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

export const upsertRecurringSurveySchedulingJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TSurveySchedulingJobData
): Promise<Job> => {
  try {
    return await upsertRecurringBackgroundJobSchedule(JOB_NAMES.surveyScheduling, identity, schedule, data);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.surveyScheduling,
        schedule,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to upsert BullMQ survey scheduling schedule"
    );
    throw error;
  }
};

export const removeRecurringSurveySchedulingJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity
): Promise<boolean> => {
  try {
    return await removeRecurringBackgroundJobSchedule(JOB_NAMES.surveyScheduling, identity);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.surveyScheduling,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to remove BullMQ survey scheduling schedule"
    );
    throw error;
  }
};

export const upsertRecurringSurveyArchivePurgeJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TSurveyArchivePurgeJobData
): Promise<Job> => {
  try {
    return await upsertRecurringBackgroundJobSchedule(JOB_NAMES.surveyArchivePurge, identity, schedule, data);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.surveyArchivePurge,
        schedule,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to upsert BullMQ survey archive purge schedule"
    );
    throw error;
  }
};

export const removeRecurringSurveyArchivePurgeJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity
): Promise<boolean> => {
  try {
    return await removeRecurringBackgroundJobSchedule(JOB_NAMES.surveyArchivePurge, identity);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.surveyArchivePurge,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to remove BullMQ survey archive purge schedule"
    );
    throw error;
  }
};

export const upsertRecurringWorkflowRunReconcileJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TWorkflowRunReconcileJobData
): Promise<Job> => {
  try {
    return await upsertRecurringBackgroundJobSchedule(
      JOB_NAMES.workflowRunReconcile,
      identity,
      schedule,
      data
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.workflowRunReconcile,
        schedule,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to upsert BullMQ workflow run reconcile schedule"
    );
    throw error;
  }
};

export const removeRecurringWorkflowRunReconcileJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity
): Promise<boolean> => {
  try {
    return await removeRecurringBackgroundJobSchedule(JOB_NAMES.workflowRunReconcile, identity);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.workflowRunReconcile,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to remove BullMQ workflow run reconcile schedule"
    );
    throw error;
  }
};

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
