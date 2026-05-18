import type { Job } from "bullmq";
import { logger } from "@formbricks/logger";
import type { AnyBackgroundJobDefinition, JobHandlerOverrides } from "@/src/contracts";
import { backgroundJobDefinitions, getBackgroundJobDefinition } from "@/src/definitions";

export const jobProcessors: Record<string, AnyBackgroundJobDefinition> = backgroundJobDefinitions;

export const getJobProcessor = (jobName: string): AnyBackgroundJobDefinition | undefined =>
  getBackgroundJobDefinition(jobName);

export const processJob = async (job: Job, handlerOverrides?: JobHandlerOverrides): Promise<void> => {
  const definition = getJobProcessor(job.name);

  if (!definition) {
    const error = new Error(`No BullMQ processor registered for job: ${job.name}`);
    logger.error({ jobId: job.id, jobName: job.name, queueName: job.queueName }, error.message);
    throw error;
  }

  const data = definition.schema.parse(job.data);
  const handler = handlerOverrides?.[job.name] ?? definition.handle;
  const maxAttempts = typeof job.opts.attempts === "number" && job.opts.attempts > 0 ? job.opts.attempts : 1;

  await handler(data, {
    attempt: job.attemptsMade + 1,
    jobId: String(job.id),
    jobName: job.name,
    maxAttempts,
    queueName: job.queueName,
  });
};
