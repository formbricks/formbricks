import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResponsePipelineJobData } from "@/src/types";

export const processResponsePipelineJob: JobHandler<TResponsePipelineJobData> = (data, context) => {
  logger.debug(
    {
      attempt: context.attempt,
      environmentId: data.environmentId,
      surveyId: data.surveyId,
      event: data.event,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "Processed placeholder response pipeline job"
  );

  return Promise.resolve();
};
