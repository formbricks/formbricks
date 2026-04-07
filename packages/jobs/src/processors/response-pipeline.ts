import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResponsePipelineJobData } from "@/src/types";

export const processResponsePipelineJob: JobHandler<TResponsePipelineJobData> = (data, context) => {
  // TODO(#1547): Replace this placeholder when the response pipeline is migrated onto BullMQ.
  logger.error(
    {
      attempt: context.attempt,
      environmentId: data.environmentId,
      surveyId: data.surveyId,
      event: data.event,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "Unimplemented response pipeline processor"
  );

  throw new Error(
    `Unimplemented response pipeline processor for job ${context.jobId} (${data.environmentId}/${data.surveyId})`
  );
};
