import { BulkJobOptions, JobsOptions, Queue, QueueOptions } from "bullmq";
import { logger } from "@formbricks/logger";
import { QueueName, WorkerService } from "../service";

export interface IJobParams {
  name: string;
  data?: any;
  options?: JobsOptions;
}

export interface IBulkJobParams {
  name: string;
  data: any;
  options?: BulkJobOptions;
}

export class BaseQueue {
  private instance: WorkerService;

  public readonly DEFAULT_ATTEMPTS = 5;
  public queue: Queue | undefined;

  constructor(
    public readonly name: QueueName,
    workerService: WorkerService
  ) {
    this.instance = workerService;
  }

  public createQueue(overrideOptions?: QueueOptions): void {
    const options = {
      ...this.getQueueOptions(),
      ...(overrideOptions && {
        defaultJobOptions: {
          ...this.getQueueOptions().defaultJobOptions,
          ...overrideOptions.defaultJobOptions,
        },
      }),
    };

    this.queue = this.instance.createQueue(this.name, options);
  }

  private getQueueOptions(): QueueOptions {
    return {
      connection: this.instance.connection,
      defaultJobOptions: {
        removeOnComplete: true,
      },
    };
  }

  public isReady(): boolean {
    return this.instance.isConnectionReady();
  }

  public async isPaused(): Promise<boolean> {
    return await this.instance.isQueuePaused();
  }

  public async getStatus() {
    return await this.instance.getStatus();
  }

  public async getWaitingCount() {
    return await this.instance.queue.getWaitingCount();
  }

  public async getDelayedCount() {
    return await this.instance.queue.getDelayedCount();
  }

  public async getActiveCount() {
    return await this.instance.queue.getActiveCount();
  }

  public async gracefulShutdown(): Promise<void> {
    logger.info(`Shutting the ${this.name} queue service down`);

    this.queue = undefined;
    await this.instance.gracefulShutdown();

    logger.info(`Shutting down the ${this.name} queue service has finished`);
  }

  public add(params: IJobParams) {
    const jobOptions = {
      removeOnComplete: true,
      removeOnFail: true,
      ...params.options,
    };

    this.instance.add(params.name, params.data, jobOptions);
  }

  public async addBulk(data: IBulkJobParams[]) {
    await this.instance.addBulk(data);
  }
}
