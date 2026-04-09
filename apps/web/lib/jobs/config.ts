import "server-only";
import type { JobsRuntimeOptions } from "@formbricks/jobs";
import { env } from "@/lib/env";

const DEFAULT_BULLMQ_WORKER_CONCURRENCY = 1;
const DEFAULT_BULLMQ_WORKER_COUNT = 1;

export interface JobsWorkerBootstrapConfig {
  enabled: boolean;
  runtimeOptions: JobsRuntimeOptions | null;
}

export interface JobsQueueingConfig {
  enabled: boolean;
  redisUrl: string | null;
}

export const BULLMQ_WORKER_CONCURRENCY = env.BULLMQ_WORKER_CONCURRENCY ?? DEFAULT_BULLMQ_WORKER_CONCURRENCY;
export const BULLMQ_WORKER_COUNT = env.BULLMQ_WORKER_COUNT ?? DEFAULT_BULLMQ_WORKER_COUNT;

const getBullMqWorkerEnabled = (): boolean => {
  if (env.BULLMQ_WORKER_ENABLED !== undefined) {
    return env.BULLMQ_WORKER_ENABLED === "1";
  }

  return env.NODE_ENV !== "test";
};

export const BULLMQ_WORKER_ENABLED = getBullMqWorkerEnabled();

export const getJobsQueueingConfig = (): JobsQueueingConfig => {
  if (!env.REDIS_URL) {
    return {
      enabled: false,
      redisUrl: null,
    };
  }

  return {
    enabled: true,
    redisUrl: env.REDIS_URL,
  };
};

export const getJobsWorkerBootstrapConfig = (): JobsWorkerBootstrapConfig => {
  if (!BULLMQ_WORKER_ENABLED) {
    return {
      enabled: false,
      runtimeOptions: null,
    };
  }

  if (!env.REDIS_URL) {
    throw new Error("REDIS_URL is required to start the BullMQ worker");
  }

  return {
    enabled: true,
    runtimeOptions: {
      concurrency: BULLMQ_WORKER_CONCURRENCY,
      redisUrl: env.REDIS_URL,
      workerCount: BULLMQ_WORKER_COUNT,
    },
  };
};
