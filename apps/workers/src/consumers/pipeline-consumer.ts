import { PipelineTriggers } from "@prisma/client";
import { Job, WorkerOptions } from "bullmq";
import { logger } from "@formbricks/logger";
import { BaseConsumer, QueueName, WorkerProcessor, WorkerService } from "@formbricks/worker";
import { processPipeline } from "../services/pipeline-service";

export class PipelineConsumer extends BaseConsumer {
  constructor() {
    super(QueueName.PIPELINE, WorkerService.getInstance(QueueName.PIPELINE));

    this.initWorker(this.getWorkerProcessor(), this.getWorkerOptions());
  }

  private getWorkerOptions(): WorkerOptions {
    return {
      connection: this.instance.connection,
      lockDuration: 180000,
      maxStalledCount: 5,
      drainDelay: 5,
      stalledInterval: 30000,
      concurrency: 200,
    };
  }

  private getWorkerProcessor(): WorkerProcessor {
    logger.info("Pipeline consumer initialized and listening for jobs");

    return async (job: Job) => {
      logger.info(`Processing job ${job.id}`);
      await processPipeline({ ...job.data, event: job.name as PipelineTriggers });
      logger.info(`Job ${job.id} completed`);
    };
  }
}
