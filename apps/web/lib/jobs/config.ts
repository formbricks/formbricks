import "server-only";
import type { JobsRuntimeOptions } from "@formbricks/jobs";
import { env } from "@/lib/env";

const DEFAULT_BULLMQ_WORKER_CONCURRENCY = 1;
const DEFAULT_BULLMQ_WORKER_COUNT = 1;

export interface JobsWorkerBootstrapConfig {
  enabled: boolean;
  runtimeOptions: JobsRuntimeOptions | null;
}

export const BULLMQ_WORKER_CONCURRENCY = env.BULLMQ_WORKER_CONCURRENCY ?? DEFAULT_BULLMQ_WORKER_CONCURRENCY;
export const BULLMQ_WORKER_COUNT = env.BULLMQ_WORKER_COUNT ?? DEFAULT_BULLMQ_WORKER_COUNT;
export const BULLMQ_WORKER_ENABLED =
  env.BULLMQ_WORKER_ENABLED !== undefined
    ? env.BULLMQ_WORKER_ENABLED === "1"
    : env.NODE_ENV === "test"
      ? false
      : true;

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
