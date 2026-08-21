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
    // A recurring schedule lives in Redis, not in the code, so it outlives the build that understood it:
    // a rollback (or a self-hoster downgrading) leaves the schedule firing at a worker with no processor
    // for that name. That is an operational fact, not a retriable error — so log it and complete the job.
    // Throwing made BullMQ retry it, fail it, and fire again next interval, which on a 3-minute schedule
    // meant a permanent stream of errors and a growing failed set (ENG-2235).
    //
    // Deliberately not `UnrecoverableError`: it would stop the retries but still fail the job, so it
    // would still grow the failed set and still trip the worker's `failed` listener into `logger.error`
    // — leaving exactly the noise this is here to remove.
    //
    // Only the ids are logged. An unknown name has no schema, so `job.data` is unvalidated and may still
    // hold a real payload — a renamed response-pipeline job would carry a full survey response.
    logger.warn(
      { jobId: job.id, jobName: job.name, queueName: job.queueName },
      "Dropping BullMQ job with no registered processor: its schedule outlived the code that handled it"
    );
    return;
  }

  // A *known* job whose payload fails to parse keeps throwing: that is a real bug, and retrying is right.
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
