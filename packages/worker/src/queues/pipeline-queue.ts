import { QueueName, WorkerService } from "../service";
import { BaseQueue } from "./base-queue";

export class PipelineQueue extends BaseQueue {
  constructor() {
    super(QueueName.PIPELINE, WorkerService.getInstance(QueueName.PIPELINE));

    this.createQueue();
  }
}

let pipelineQueueInstance: PipelineQueue | null = null;

export const queuePipelineJob = async <T = unknown>(name: string, data: T) => {
  if (!pipelineQueueInstance) {
    pipelineQueueInstance = new PipelineQueue();
  }

  await pipelineQueueInstance.add({
    name,
    data,
  });
};
