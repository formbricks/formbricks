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
import type { BackgroundJobProducer, EnqueuedJob, UpsertedRecurringJobSchedule } from "@/src/contracts";
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
  type TSurveySchedulingJobData,
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

const toUpsertedRecurringJobSchedule = (
  job: Pick<Job, "id" | "name" | "queueName">,
  identity: TBackgroundJobScheduleIdentity
): UpsertedRecurringJobSchedule => ({
  ...toEnqueuedJob(job),
  scheduleId: identity.scheduleId,
  scope: identity.scope,
});

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

export const enqueueSurveySchedulingJob = async (data: TSurveySchedulingJobData): Promise<Job> => {
  try {
    return await enqueueBackgroundJob(JOB_NAMES.surveyScheduling, data);
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.surveyScheduling },
      "Failed to enqueue BullMQ survey scheduling job"
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

export const scheduleResponsePipelineJobAt = async (
  schedule: TRunAtBackgroundJobSchedule,
  data: TResponsePipelineJobData
): Promise<Job> => {
  try {
    return await scheduleBackgroundJobAt(JOB_NAMES.responsePipeline, schedule, data);
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.responsePipeline, schedule },
      "Failed to schedule BullMQ response pipeline job"
    );
    throw error;
  }
};

export const scheduleSurveySchedulingJobAt = async (
  schedule: TRunAtBackgroundJobSchedule,
  data: TSurveySchedulingJobData
): Promise<Job> => {
  try {
    return await scheduleBackgroundJobAt(JOB_NAMES.surveyScheduling, schedule, data);
  } catch (error) {
    logger.error(
      { err: error, jobName: JOB_NAMES.surveyScheduling, schedule },
      "Failed to schedule BullMQ survey scheduling job"
    );
    throw error;
  }
};

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

export const upsertRecurringResponsePipelineJobSchedule = async (
  identity: TBackgroundJobScheduleIdentity,
  schedule: TRecurringBackgroundJobSchedule,
  data: TResponsePipelineJobData
): Promise<Job> => {
  try {
    return await upsertRecurringBackgroundJobSchedule(JOB_NAMES.responsePipeline, identity, schedule, data);
  } catch (error) {
    logger.error(
      {
        err: error,
        jobName: JOB_NAMES.responsePipeline,
        schedule,
        scheduleId: identity.scheduleId,
        scope: identity.scope,
      },
      "Failed to upsert BullMQ response pipeline schedule"
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

export const getBackgroundJobProducer = (): BackgroundJobProducer => ({
  enqueueResponsePipeline: async (data) => toEnqueuedJob(await enqueueResponsePipelineJob(data)),
  enqueueSurveyScheduling: async (data) => toEnqueuedJob(await enqueueSurveySchedulingJob(data)),
  enqueueTestLog: async (data) => toEnqueuedJob(await enqueueTestLogJob(data)),
  enqueueWorkflowRun: async (data, options) => toEnqueuedJob(await enqueueWorkflowRunJob(data, options)),
  scheduleResponsePipelineAt: async (schedule, data) =>
    toEnqueuedJob(await scheduleResponsePipelineJobAt(schedule, data)),
  scheduleSurveySchedulingAt: async (schedule, data) =>
    toEnqueuedJob(await scheduleSurveySchedulingJobAt(schedule, data)),
  scheduleTestLogAt: async (schedule, data) => toEnqueuedJob(await scheduleTestLogJobAt(schedule, data)),
  upsertRecurringResponsePipelineSchedule: async (identity, schedule, data) =>
    toUpsertedRecurringJobSchedule(
      await upsertRecurringResponsePipelineJobSchedule(identity, schedule, data),
      identity
    ),
  upsertRecurringSurveySchedulingSchedule: async (identity, schedule, data) =>
    toUpsertedRecurringJobSchedule(
      await upsertRecurringSurveySchedulingJobSchedule(identity, schedule, data),
      identity
    ),
  upsertRecurringTestLogSchedule: async (identity, schedule, data) =>
    toUpsertedRecurringJobSchedule(
      await upsertRecurringTestLogJobSchedule(identity, schedule, data),
      identity
    ),
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
