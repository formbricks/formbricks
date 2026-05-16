import { logger } from "@formbricks/logger";
import type { JobHandler } from "@/src/contracts";
import type { TTestLogJobData } from "@/src/types";

export const processTestLogJob: JobHandler<TTestLogJobData> = (data, context) => {
  logger.debug(
    {
      attempt: context.attempt,
      context: data.context,
      jobId: context.jobId,
      jobName: context.jobName,
      queueName: context.queueName,
    },
    data.message
  );

  if (data.shouldFail) {
    return Promise.reject(new Error(`Test log job failed intentionally: ${data.message}`));
  }

  return Promise.resolve();
};
