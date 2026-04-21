import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TAITranslationJobData } from "@/src/types";

export const processAITranslationJob: JobHandler<TAITranslationJobData> = (data, context) => {
  logger.error(
    {
      attempt: context.attempt,
      workspaceId: data.workspaceId,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    "BullMQ AI translation processor override is not registered"
  );

  throw new Error(
    `BullMQ AI translation processor override missing for job ${context.jobId} (${data.workspaceId})`
  );
};
