import {
  BulkJobOptions,
  JobsOptions,
  MetricsTime,
  Processor,
  Queue,
  QueueOptions,
  RedisClient,
  Worker,
  WorkerOptions,
} from "bullmq";
import { logger } from "@formbricks/logger";
import { closeRedisConnection, createRedisClient, getRedisConnectionStatus } from "./redis-connection";

export enum QueueName {
  RESPONSE = "responseJobs",
  WEBHOOK = "webhookJobs",
  SCHEDULED = "repeatableJobs",
}

export class WorkerService {
  private _queue: Queue;
  private _worker: Worker;
  private _connection: RedisClient;
  private static _instances: Map<QueueName, WorkerService> = new Map();

  public get worker(): Worker {
    return this._worker;
  }

  public get queue(): Queue {
    return this._queue;
  }

  public get connection(): RedisClient {
    return this._connection;
  }

  // Factory method to get/create WorkerService instances
  public static getInstance(name?: QueueName): WorkerService {
    if (name && WorkerService._instances.has(name)) {
      return WorkerService._instances.get(name)!;
    }

    const instance = new WorkerService();
    if (name) {
      WorkerService._instances.set(name, instance);
    }

    return instance;
  }

  constructor() {
    this._connection = createRedisClient();
    logger.info("WorkerService created with reused Redis connection");
  }

  public isConnectionReady(): boolean {
    return getRedisConnectionStatus() === "ready";
  }

  public createQueue(name: QueueName, queueOptions: QueueOptions) {
    const config = {
      connection: this._connection,
      ...(queueOptions?.defaultJobOptions && {
        defaultJobOptions: {
          ...queueOptions.defaultJobOptions,
        },
      }),
    };

    logger.info(`Creating queue ${name}.`);

    this._queue = new Queue(name, config);

    return this._queue;
  }

  public createWorker(
    name: QueueName,
    processor?: string | Processor<any, unknown | void, string>,
    workerOptions?: WorkerOptions
  ) {
    const { concurrency, lockDuration, settings } = workerOptions || {};

    const config = {
      connection: this._connection,
      ...(concurrency && { concurrency }),
      ...(lockDuration && { lockDuration }),
      ...(settings && { settings }),
      metrics: { maxDataPoints: MetricsTime.ONE_MONTH },
    };

    logger.info(`Creating worker ${name}.`);

    this._worker = new Worker(name, processor, config);

    return this._worker;
  }

  public async add<T = unknown>(name: string, data: T, options: JobsOptions = {}) {
    try {
      await this._queue.add(name, data, options);
    } catch (error) {
      logger.error(`Failed to add job ${name}: ${error}`);
      throw error;
    }
  }

  public async addBulk<T = unknown>(
    data: {
      name: string;
      data: T;
      options?: BulkJobOptions;
    }[]
  ) {
    try {
      const jobs = data.map((job) => {
        const jobOptions = {
          removeOnComplete: true,
          removeOnFail: true,
          ...job?.options,
        };

        const jobResult: {
          name: string;
          data: any;
          opts?: BulkJobOptions;
        } = { name: job.name, data: job.data, opts: jobOptions };

        return jobResult;
      });

      await this._queue.addBulk(jobs);
    } catch (error) {
      logger.error(`Failed to add bulk jobs: ${error}`);
      throw error;
    }
  }

  public async gracefulShutdown(): Promise<void> {
    logger.info("Shutting the BullMQ service down");

    try {
      if (this._queue) {
        await this._queue.close();
      }
      if (this._worker) {
        await this._worker.close();
      }

      // Allow a small delay for clean disconnection
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Find and remove this instance from the static instances map
      for (const [key, instance] of WorkerService._instances.entries()) {
        if (instance === this) {
          WorkerService._instances.delete(key);
          break;
        }
      }

      // Only close the connection if no more active services are using it
      if (WorkerService._instances.size === 0) {
        await closeRedisConnection();
      }

      logger.info("Shutting down the BullMQ service has finished");
    } catch (error) {
      logger.error(`Error during BullMQ service shutdown: ${error}`);
      throw error;
    }
  }

  public async getStatus(): Promise<{
    queueIsPaused: boolean | undefined;
    queueName: string | undefined;
    workerIsPaused: boolean | undefined;
    workerIsRunning: boolean | undefined;
    workerName: string | undefined;
  }> {
    const [queueIsPaused, workerIsPaused, workerIsRunning] = await Promise.all([
      this.isQueuePaused(),
      this.isWorkerPaused(),
      this.isWorkerRunning(),
    ]);

    return {
      queueIsPaused,
      queueName: this._queue?.name,
      workerIsPaused,
      workerIsRunning,
      workerName: this._worker?.name,
    };
  }

  public async isQueuePaused(): Promise<boolean> {
    return await this._queue?.isPaused();
  }

  public isWorkerPaused(): boolean {
    return this._worker?.isPaused();
  }

  public isWorkerRunning(): boolean {
    return this._worker?.isRunning();
  }

  public async pauseWorker(): Promise<void> {
    if (!this._worker) {
      return;
    }

    try {
      await this._worker.pause(true);
      logger.info(`Worker ${this._worker.name} pause succeeded`);
    } catch (error) {
      logger.error(error, `Worker ${this._worker.name} pause failed`);

      throw error;
    }
  }

  public resumeWorker(): void {
    if (!this._worker) {
      return;
    }

    try {
      this._worker.resume();
      logger.info(`Worker ${this._worker.name} resume succeeded`);
    } catch (error) {
      logger.error(error, `Worker ${this._worker.name} resume failed`);

      throw error;
    }
  }
}
