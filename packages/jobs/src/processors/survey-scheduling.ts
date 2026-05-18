import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TSurveySchedulingJobData } from "@/src/types";

export const processSurveySchedulingJob: JobHandler<TSurveySchedulingJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
      scope: data.scope,
    },
    "BullMQ survey scheduling processor override is not registered"
  );

  throw new Error(
    `BullMQ survey scheduling processor override missing for job ${context.jobId} (${data.scope})`
  );
};
