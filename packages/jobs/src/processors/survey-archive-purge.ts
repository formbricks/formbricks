import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TSurveyArchivePurgeJobData } from "@/src/types";

export const processSurveyArchivePurgeJob: JobHandler<TSurveyArchivePurgeJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
      scope: data.scope,
    },
    "BullMQ survey archive purge processor override is not registered"
  );

  throw new Error(
    `BullMQ survey archive purge processor override missing for job ${context.jobId} (${data.scope})`
  );
};
