import { type Job, type Queue, Worker } from "bullmq";
import type IORedis from "ioredis";
import { logger } from "@formbricks/logger";
import { closeRedisConnection, createProducerConnection, createWorkerConnection } from "@/src/connection";
import {
  DEDICATED_JOBS_QUEUE_NAMES,
  JOBS_PREFIX,
  JOBS_QUEUE_NAME,
  type TDedicatedJobsQueueName,
  type TJobsQueueName,
} from "@/src/constants";
import type { JobHandlerOverrides } from "@/src/contracts";
import { processJob } from "@/src/processors/registry";
import { createJobsQueues } from "@/src/queue";

const DEFAULT_WORKER_CONCURRENCY = 1;
const DEFAULT_WORKER_COUNT = 1;

/**
 * A dedicated queue's jobs are short and recurring (AuthZed delivery runs every 5 s), so one slot per
 * runtime is enough; replicas add more. Deliberately not `concurrency`/`workerCount`: those size the
 * default queue for its own workload, and tuning them must not starve — or multiply — this one.
 */
const DEDICATED_WORKER_CONCURRENCY = 1;

export interface JobsRuntimeOptions {
  redisUrl: string;
  prefix?: string;
  concurrency?: number;
  workerCount?: number;
  jobHandlerOverrides?: JobHandlerOverrides;
}

export interface JobsRuntimeHandle {
  /** The default `background-jobs` queue. */
  queue: Queue;
  /** Every queue this runtime serves, keyed by name — the default one and each dedicated one. */
  queues: Readonly<Record<TJobsQueueName, Queue>>;
  /** The `workerCount` workers on the default queue, each running `concurrency` jobs at once. */
  workers: Worker[];
  /** One worker per dedicated queue, sized independently of `workerCount` and `concurrency`. */
  dedicatedWorkers: Readonly<Record<TDedicatedJobsQueueName, Worker>>;
  close: () => Promise<void>;
}

type TSignalHandler = () => void;

const removeProcessListener = (event: "SIGTERM" | "SIGINT", handler: TSignalHandler): void => {
  process.removeListener(event, handler);
};

const getPositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
};

const registerWorkerLogging = (worker: Worker, queueName: TJobsQueueName, workerNumber: number): void => {
  worker.on("error", (error) => {
    logger.error({ err: error, queueName, workerNumber }, "BullMQ worker error");
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
  jobHandlerOverrides,
}: JobsRuntimeOptions): Promise<JobsRuntimeHandle> => {
  const resolvedConcurrency = getPositiveInteger(concurrency, "BullMQ worker concurrency");
  const resolvedWorkerCount = getPositiveInteger(workerCount, "BullMQ worker count");
  const producerConnection = createProducerConnection({
    redisUrl,
    connectionName: "formbricks-jobs-runtime-producer",
  });

  let queues: Readonly<Record<TJobsQueueName, Queue>> | undefined;
  const workerConnections: { connection: IORedis; connectionName: string }[] = [];
  const workers: Worker[] = [];
  const dedicatedWorkers: Partial<Record<TDedicatedJobsQueueName, Worker>> = {};
  let closeRuntimePromise: Promise<void> | undefined;

  const closeRuntime = async (): Promise<void> => {
    if (!closeRuntimePromise) {
      closeRuntimePromise = (async () => {
        removeProcessListener("SIGTERM", handleSigterm);
        removeProcessListener("SIGINT", handleSigint);

        const closeConnectionSafely = async (connection: IORedis, connectionName: string): Promise<void> => {
          try {
            await closeRedisConnection(connection);
          } catch (error) {
            logger.error({ err: error, connectionName }, "Failed to close BullMQ Redis connection cleanly");
          }
        };

        const closeWorkerSafely = async (
          worker: Worker,
          queueName: TJobsQueueName,
          workerNumber: number
        ): Promise<void> => {
          try {
            await worker.close();
          } catch (error) {
            logger.error({ err: error, queueName, workerNumber }, "Failed to close BullMQ worker cleanly");
          }
        };

        await Promise.all([
          ...workers.map((worker, index) => closeWorkerSafely(worker, JOBS_QUEUE_NAME, index + 1)),
          ...DEDICATED_JOBS_QUEUE_NAMES.flatMap((queueName) => {
            const worker = dedicatedWorkers[queueName];
            return worker ? [closeWorkerSafely(worker, queueName, 1)] : [];
          }),
        ]);

        if (queues) {
          await Promise.all(
            Object.entries(queues).map(async ([queueName, queue]) => {
              try {
                await queue.close();
              } catch (error) {
                logger.error({ err: error, queueName }, "Failed to close BullMQ queue cleanly");
              }
            })
          );
        }

        await Promise.all([
          closeConnectionSafely(producerConnection, "producer"),
          ...workerConnections.map(({ connection, connectionName }) =>
            closeConnectionSafely(connection, connectionName)
          ),
        ]);
      })();
    }

    await closeRuntimePromise;
  };

  const handleSigterm = (): void => {
    void closeRuntime()
      .catch((error: unknown) => {
        logger.error({ err: error }, "BullMQ shutdown failed in closeRuntime after SIGTERM");
      })
      .finally(() => {
        process.exit(0);
      });
  };

  const handleSigint = (): void => {
    void closeRuntime()
      .catch((error: unknown) => {
        logger.error({ err: error }, "BullMQ shutdown failed in closeRuntime after SIGINT");
      })
      .finally(() => {
        process.exit(0);
      });
  };

  const startWorker = (
    queueName: TJobsQueueName,
    workerNumber: number,
    workerConcurrency: number,
    connectionName: string
  ): Worker => {
    const connection = createWorkerConnection({
      redisUrl,
      connectionName: `formbricks-jobs-runtime-${connectionName}`,
    });
    workerConnections.push({ connection, connectionName });
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        await processJob(job, jobHandlerOverrides);
      },
      {
        connection,
        concurrency: workerConcurrency,
        prefix,
      }
    );

    registerWorkerLogging(worker, queueName, workerNumber);
    return worker;
  };

  try {
    queues = createJobsQueues({ connection: producerConnection, prefix });

    for (let workerIndex = 0; workerIndex < resolvedWorkerCount; workerIndex++) {
      const workerNumber = workerIndex + 1;
      workers.push(
        startWorker(JOBS_QUEUE_NAME, workerNumber, resolvedConcurrency, `worker-${workerNumber.toString()}`)
      );
    }

    for (const queueName of DEDICATED_JOBS_QUEUE_NAMES) {
      dedicatedWorkers[queueName] = startWorker(
        queueName,
        1,
        DEDICATED_WORKER_CONCURRENCY,
        `${queueName}-worker`
      );
    }

    // Every dedicated queue name was just assigned a worker above; the Partial only covers a startup
    // that throws midway, which `closeRuntime` has to clean up.
    const startedDedicatedWorkers = dedicatedWorkers as Record<TDedicatedJobsQueueName, Worker>;

    await Promise.all([
      ...Object.values(queues).map((queue) => queue.waitUntilReady()),
      ...workers.map((worker) => worker.waitUntilReady()),
      ...Object.values(startedDedicatedWorkers).map((worker) => worker.waitUntilReady()),
    ]);

    process.once("SIGTERM", handleSigterm);
    process.once("SIGINT", handleSigint);

    logger.info(
      {
        dedicatedQueueNames: [...DEDICATED_JOBS_QUEUE_NAMES],
        queueName: JOBS_QUEUE_NAME,
        prefix,
        workerConcurrency: resolvedConcurrency,
        workerCount: resolvedWorkerCount,
      },
      "BullMQ runtime started"
    );

    return {
      queue: queues[JOBS_QUEUE_NAME],
      queues,
      workers,
      dedicatedWorkers: startedDedicatedWorkers,
      close: closeRuntime,
    };
  } catch (error) {
    logger.error({ err: error, queueName: JOBS_QUEUE_NAME, prefix }, "Failed to start BullMQ runtime");
    await closeRuntime();
    throw error;
  }
};
