import { randomUUID } from "crypto";
import { createCacheKey } from "@formbricks/cache";
import { logger } from "@formbricks/logger";
import { cache } from "@/lib/cache";
import { CRON_SECRET, WEBAPP_URL } from "@/lib/constants";
import { convertDatesInObject } from "@/lib/time";
import { TPipelineInput, TPipelineJob } from "./types/pipelines";

const PIPELINE_QUEUE_KEYS = {
  pending: createCacheKey.custom("pipeline", "jobs", "pending"),
  delayed: createCacheKey.custom("pipeline", "jobs", "delayed"),
  lock: createCacheKey.custom("pipeline", "drain", "lock"),
} as const;

const PIPELINE_DATE_KEYS_TO_IGNORE = new Set(["contactAttributes", "variables", "data", "meta"]);

export const PIPELINE_CONCURRENCY_LIMIT = 3;
export const PIPELINE_BATCH_SIZE = 9;
export const PIPELINE_MAX_ATTEMPTS = 5;
export const PIPELINE_DRAIN_LOCK_TTL_MS = 60_000;
export const PIPELINE_RETRY_BASE_DELAY_MS = 1_000;
export const PIPELINE_RETRY_MAX_DELAY_MS = 60_000;

type TPipelineRedisClient = NonNullable<Awaited<ReturnType<typeof cache.getRedisClient>>>;
type TProcessPipelineJob = (job: TPipelineJob) => Promise<void>;

type TDrainPipelineQueueOptions = {
  processJob: TProcessPipelineJob;
};

type TQueuedJobResult = "processed" | "requeued" | "dropped";

export type TDrainPipelineQueueResult = {
  acquiredLock: boolean;
  movedReadyJobs: number;
  processedJobs: number;
  requeuedJobs: number;
  droppedJobs: number;
};

const globalForPipelineQueue = globalThis as typeof globalThis & {
  formbricksPipelineDrainTimer?: ReturnType<typeof setTimeout>;
  formbricksPipelineDrainAt?: number;
};

const getPipelineRedisClient = async (): Promise<TPipelineRedisClient> => {
  const redis = await cache.getRedisClient();

  if (!redis) {
    throw new Error("Pipeline queue requires Redis");
  }

  return redis;
};

const serializePipelineJob = (job: TPipelineJob): string => JSON.stringify(job);

const deserializePipelineJob = (serializedJob: string): TPipelineJob => {
  const parsedJob = JSON.parse(serializedJob) as TPipelineJob;
  return convertDatesInObject(parsedJob, PIPELINE_DATE_KEYS_TO_IGNORE);
};

const createPipelineJob = (job: TPipelineInput): TPipelineJob => ({
  ...job,
  jobId: randomUUID(),
  attempt: 1,
  enqueuedAt: Date.now(),
  notBefore: null,
});

const getRetryDelayMs = (attempt: number): number =>
  Math.min(PIPELINE_RETRY_BASE_DELAY_MS * 2 ** Math.max(attempt - 1, 0), PIPELINE_RETRY_MAX_DELAY_MS);

const releasePipelineDrainLock = async (redis: TPipelineRedisClient, lockToken: string): Promise<void> => {
  await redis.eval(
    'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end',
    {
      keys: [PIPELINE_QUEUE_KEYS.lock],
      arguments: [lockToken],
    }
  );
};

const triggerPipelineDrainFetch = async (): Promise<void> => {
  if (!CRON_SECRET || !WEBAPP_URL) {
    logger.warn("Skipping pipeline drain trigger because CRON_SECRET or WEBAPP_URL is not configured");
    return;
  }

  await fetch(`${WEBAPP_URL}/api/pipeline`, {
    method: "POST",
    headers: {
      "x-api-key": CRON_SECRET,
    },
  }).catch((error) => {
    logger.error({ error }, "Failed to trigger pipeline drain");
  });
};

const schedulePipelineDrain = (delayMs: number): void => {
  if (!CRON_SECRET || !WEBAPP_URL) {
    logger.warn("Skipping pipeline drain trigger because CRON_SECRET or WEBAPP_URL is not configured");
    return;
  }

  const normalizedDelayMs = Math.max(delayMs, 0);
  const targetRunAt = Date.now() + normalizedDelayMs;

  if (
    globalForPipelineQueue.formbricksPipelineDrainTimer &&
    globalForPipelineQueue.formbricksPipelineDrainAt !== undefined &&
    globalForPipelineQueue.formbricksPipelineDrainAt <= targetRunAt
  ) {
    return;
  }

  if (globalForPipelineQueue.formbricksPipelineDrainTimer) {
    clearTimeout(globalForPipelineQueue.formbricksPipelineDrainTimer);
  }

  globalForPipelineQueue.formbricksPipelineDrainAt = targetRunAt;
  globalForPipelineQueue.formbricksPipelineDrainTimer = setTimeout(() => {
    globalForPipelineQueue.formbricksPipelineDrainTimer = undefined;
    globalForPipelineQueue.formbricksPipelineDrainAt = undefined;
    void triggerPipelineDrainFetch();
  }, normalizedDelayMs);
};

const moveReadyDelayedJobs = async (redis: TPipelineRedisClient): Promise<number> => {
  const readyJobs = await redis.zRangeByScore(PIPELINE_QUEUE_KEYS.delayed, 0, Date.now());

  for (const readyJob of readyJobs) {
    await redis.zRem(PIPELINE_QUEUE_KEYS.delayed, readyJob);
    await redis.rPush(PIPELINE_QUEUE_KEYS.pending, readyJob);
  }

  return readyJobs.length;
};

const popPendingJobs = async (
  redis: TPipelineRedisClient,
  count: number
): Promise<{ jobs: TPipelineJob[]; droppedJobs: number }> => {
  const jobs: TPipelineJob[] = [];
  let droppedJobs = 0;

  for (let index = 0; index < count; index++) {
    const serializedJob = await redis.lPop(PIPELINE_QUEUE_KEYS.pending);

    if (!serializedJob) {
      break;
    }

    try {
      jobs.push(deserializePipelineJob(serializedJob));
    } catch (error) {
      droppedJobs++;
      logger.error({ error, serializedJob }, "Dropping invalid pipeline job payload");
    }
  }

  return { jobs, droppedJobs };
};

const getNextDelayedJobDelayMs = async (redis: TPipelineRedisClient): Promise<number | null> => {
  const [nextDelayedJob] = await redis.zRangeByScoreWithScores(PIPELINE_QUEUE_KEYS.delayed, 0, "+inf", {
    LIMIT: {
      offset: 0,
      count: 1,
    },
  });

  if (!nextDelayedJob) {
    return null;
  }

  return Math.max(nextDelayedJob.score - Date.now(), 0);
};

const handleFailedPipelineJob = async (
  redis: TPipelineRedisClient,
  job: TPipelineJob,
  error: unknown
): Promise<TQueuedJobResult> => {
  if (job.attempt >= PIPELINE_MAX_ATTEMPTS) {
    logger.error(
      { error, jobId: job.jobId, attempt: job.attempt },
      "Dropping pipeline job after max retries"
    );
    return "dropped";
  }

  const nextAttempt = job.attempt + 1;
  const retryDelayMs = getRetryDelayMs(job.attempt);
  const notBefore = Date.now() + retryDelayMs;
  const retriedJob: TPipelineJob = {
    ...job,
    attempt: nextAttempt,
    notBefore,
  };

  await redis.zAdd(PIPELINE_QUEUE_KEYS.delayed, {
    score: notBefore,
    value: serializePipelineJob(retriedJob),
  });

  schedulePipelineDrain(retryDelayMs);

  logger.warn(
    { error, jobId: job.jobId, attempt: job.attempt, nextAttempt, retryDelayMs },
    "Requeued pipeline job after processing failure"
  );

  return "requeued";
};

const processQueuedJob = async (
  redis: TPipelineRedisClient,
  processJob: TProcessPipelineJob,
  job: TPipelineJob
): Promise<TQueuedJobResult> => {
  try {
    await processJob(job);
    return "processed";
  } catch (error) {
    return handleFailedPipelineJob(redis, job, error);
  }
};

export const triggerPipelineDrain = (): void => {
  schedulePipelineDrain(0);
};

export const enqueuePipelineJob = async (job: TPipelineInput): Promise<TPipelineJob> => {
  const redis = await getPipelineRedisClient();
  const queuedJob = createPipelineJob(job);

  await redis.rPush(PIPELINE_QUEUE_KEYS.pending, serializePipelineJob(queuedJob));

  return queuedJob;
};

export const drainPipelineQueue = async ({
  processJob,
}: TDrainPipelineQueueOptions): Promise<TDrainPipelineQueueResult> => {
  const redis = await getPipelineRedisClient();
  const lockToken = randomUUID();
  const lockResult = await cache.tryLock(PIPELINE_QUEUE_KEYS.lock, lockToken, PIPELINE_DRAIN_LOCK_TTL_MS);

  if (!lockResult.ok) {
    throw new Error(`Failed to acquire pipeline drain lock: ${lockResult.error.code}`);
  }

  if (!lockResult.data) {
    return {
      acquiredLock: false,
      movedReadyJobs: 0,
      processedJobs: 0,
      requeuedJobs: 0,
      droppedJobs: 0,
    };
  }

  try {
    const movedReadyJobs = await moveReadyDelayedJobs(redis);
    const poppedJobs = await popPendingJobs(redis, PIPELINE_BATCH_SIZE);

    let processedJobs = 0;
    let requeuedJobs = 0;
    let droppedJobs = poppedJobs.droppedJobs;

    for (let index = 0; index < poppedJobs.jobs.length; index += PIPELINE_CONCURRENCY_LIMIT) {
      const jobChunk = poppedJobs.jobs.slice(index, index + PIPELINE_CONCURRENCY_LIMIT);
      const chunkResults = await Promise.all(jobChunk.map((job) => processQueuedJob(redis, processJob, job)));

      chunkResults.forEach((result) => {
        if (result === "processed") {
          processedJobs++;
        } else if (result === "requeued") {
          requeuedJobs++;
        } else {
          droppedJobs++;
        }
      });
    }

    const remainingPendingJobs = await redis.lLen(PIPELINE_QUEUE_KEYS.pending);
    const nextDelayedJobDelayMs = await getNextDelayedJobDelayMs(redis);

    if (remainingPendingJobs > 0) {
      triggerPipelineDrain();
    }

    if (nextDelayedJobDelayMs !== null) {
      schedulePipelineDrain(nextDelayedJobDelayMs);
    }

    return {
      acquiredLock: true,
      movedReadyJobs,
      processedJobs,
      requeuedJobs,
      droppedJobs,
    };
  } finally {
    await releasePipelineDrainLock(redis, lockToken);
  }
};
