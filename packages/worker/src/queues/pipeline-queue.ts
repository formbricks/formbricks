import { QueueName, WorkerService } from "../service";
import { BaseQueue } from "./base-queue";

export class PipelineQueue extends BaseQueue {
  constructor() {
    super(QueueName.PIPELINE, WorkerService.getInstance(QueueName.PIPELINE));

    this.createQueue();
  }
}

export const queuePipelineJob = async <T = unknown>(name: string, data: T) => {
  const queue = new PipelineQueue();

  await queue.add({
    name,
    data,
  });
};
