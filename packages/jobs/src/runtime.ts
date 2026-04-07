import { type Job, type Queue, Worker } from "bullmq";
import type IORedis from "ioredis";
import { logger } from "@formbricks/logger";
import { closeRedisConnection, createProducerConnection, createWorkerConnection } from "@/src/connection";
import { JOBS_PREFIX, JOBS_QUEUE_NAME } from "@/src/constants";
import { processJob } from "@/src/processors/registry";
import { createJobsQueue } from "@/src/queue";

const DEFAULT_WORKER_CONCURRENCY = 1;
const DEFAULT_WORKER_COUNT = 1;

export interface JobsRuntimeOptions {
  redisUrl: string;
  prefix?: string;
  concurrency?: number;
  workerCount?: number;
}

export interface JobsRuntimeHandle {
  queue: Queue;
  workers: Worker[];
  close: () => Promise<void>;
}

type TSignalHandler = () => Promise<void>;

const removeProcessListener = (event: "SIGTERM" | "SIGINT", handler: TSignalHandler): void => {
  process.removeListener(event, handler);
};

const getPositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
};

const registerWorkerLogging = (worker: Worker, workerNumber: number): void => {
  worker.on("error", (error) => {
    logger.error({ err: error, queueName: JOBS_QUEUE_NAME, workerNumber }, "BullMQ worker error");
  });

  worker.on("failed", (job, error) => {
    logger.error(
      {
        err: error,
        attemptsMade: job?.attemptsMade,
        jobId: job?.id,
        jobName: job?.name,
        queueName: job?.queueName,
        workerNumber,
      },
      "BullMQ job failed"
    );
  });

  worker.on("completed", (job) => {
    logger.debug(
      {
        attemptsMade: job.attemptsMade,
        jobId: job.id,
        jobName: job.name,
        queueName: job.queueName,
        workerNumber,
      },
      "BullMQ job completed"
    );
  });
};

export const startJobsRuntime = async ({
  redisUrl,
  prefix = JOBS_PREFIX,
  concurrency = DEFAULT_WORKER_CONCURRENCY,
  workerCount = DEFAULT_WORKER_COUNT,
}: JobsRuntimeOptions): Promise<JobsRuntimeHandle> => {
  const resolvedConcurrency = getPositiveInteger(concurrency, "BullMQ worker concurrency");
  const resolvedWorkerCount = getPositiveInteger(workerCount, "BullMQ worker count");
  const producerConnection = createProducerConnection({
    redisUrl,
    connectionName: "formbricks-jobs-runtime-producer",
  });

  let queue: Queue | undefined;
  const workerConnections: IORedis[] = [];
  const workers: Worker[] = [];
  let closeRuntimePromise: Promise<void> | undefined;

  const closeRuntime = async (): Promise<void> => {
    if (!closeRuntimePromise) {
      closeRuntimePromise = (async () => {
        removeProcessListener("SIGTERM", handleSigterm);
        removeProcessListener("SIGINT", handleSigint);

        await Promise.all(
          workers.map(async (worker, index) => {
            try {
              await worker.close();
            } catch (error) {
              logger.error({ err: error, workerNumber: index + 1 }, "Failed to close BullMQ worker cleanly");
            }
          })
        );

        if (queue) {
          try {
            await queue.close();
          } catch (error) {
            logger.error({ err: error }, "Failed to close BullMQ queue cleanly");
          }
        }

        await Promise.all([
          closeRedisConnection(producerConnection),
          ...workerConnections.map((workerConnection) => closeRedisConnection(workerConnection)),
        ]);
      })();
    }

    await closeRuntimePromise;
  };

  const handleSigterm = async (): Promise<void> => {
    await closeRuntime().catch((error: unknown) => {
      logger.error({ err: error }, "BullMQ shutdown failed in closeRuntime after SIGTERM");
    });
  };

  const handleSigint = async (): Promise<void> => {
    await closeRuntime().catch((error: unknown) => {
      logger.error({ err: error }, "BullMQ shutdown failed in closeRuntime after SIGINT");
    });
  };

  try {
    queue = createJobsQueue({ connection: producerConnection, prefix });

    for (let workerIndex = 0; workerIndex < resolvedWorkerCount; workerIndex++) {
      const workerConnection = createWorkerConnection({
        redisUrl,
        connectionName: `formbricks-jobs-runtime-worker-${(workerIndex + 1).toString()}`,
      });
      const worker = new Worker(
        JOBS_QUEUE_NAME,
        async (job: Job) => {
          await processJob(job);
        },
        {
          connection: workerConnection,
          concurrency: resolvedConcurrency,
          prefix,
        }
      );

      workerConnections.push(workerConnection);
      workers.push(worker);
      registerWorkerLogging(worker, workerIndex + 1);
    }

    await Promise.all([queue.waitUntilReady(), ...workers.map((worker) => worker.waitUntilReady())]);

    process.once("SIGTERM", handleSigterm);
    process.once("SIGINT", handleSigint);

    logger.info(
      {
        queueName: JOBS_QUEUE_NAME,
        prefix,
        workerConcurrency: resolvedConcurrency,
        workerCount: resolvedWorkerCount,
      },
      "BullMQ runtime started"
    );

    return {
      queue,
      workers,
      close: closeRuntime,
    };
  } catch (error) {
    logger.error({ err: error, queueName: JOBS_QUEUE_NAME, prefix }, "Failed to start BullMQ runtime");
    await closeRuntime();
    throw error;
  }
};
