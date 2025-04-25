import { Processor, Worker, WorkerOptions } from "bullmq";
import { logger } from "@formbricks/logger";
import { QueueName, WorkerService } from "../service";

export type WorkerProcessor = string | Processor<any, unknown, string> | undefined;

export class BaseConsumer {
  protected instance: WorkerService;

  public readonly DEFAULT_ATTEMPTS = 5;

  constructor(
    public readonly name: QueueName,
    public workerService: WorkerService
  ) {
    this.instance = workerService;
  }

  public get worker(): Worker | undefined {
    return this.instance.worker;
  }

  public initWorker(processor: WorkerProcessor, options?: WorkerOptions): void {
    logger.info(`Worker ${this.name} initialized`);

    this.createWorker(processor, options);
  }

  public createWorker(processor: WorkerProcessor, options?: WorkerOptions): void {
    if (this.worker) {
      logger.info(`Worker ${this.name} already initialized`);
      return;
    }

    this.instance.createWorker(this.name, processor, options);
  }

  public isRunning(): boolean {
    return this.instance.isWorkerRunning();
  }

  public isPaused(): boolean {
    return this.instance.isWorkerPaused();
  }

  public async pause(): Promise<void> {
    if (!this.worker) {
      return;
    }

    await this.instance.pauseWorker();
  }

  public resume(): void {
    if (!this.worker) {
      return;
    }

    this.instance.resumeWorker();
  }

  public async gracefulShutdown(): Promise<void> {
    logger.info(`Shutting the ${this.name} worker service down`);

    await this.instance.gracefulShutdown();

    logger.info(`Shutting down the ${this.name} worker service has finished`);
  }
}
