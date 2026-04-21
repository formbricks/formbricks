import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TResponsePipelineJobData } from "@/src/types";

export const processResponsePipelineJob: JobHandler<TResponsePipelineJobData> = (data, context) => {
  // TODO(#1548): Keep this fallback until every runtime that starts BullMQ registers the app override.
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
    "BullMQ response pipeline processor override is not registered"
  );

  throw new Error(
    `BullMQ response pipeline processor override missing for job ${context.jobId} (${data.environmentId}/${data.surveyId})`
  );
};
