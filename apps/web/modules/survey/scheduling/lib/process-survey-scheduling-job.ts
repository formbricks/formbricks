import "server-only";
import type { JobHandler, TSurveySchedulingJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { reconcileDueSurveySchedules } from "./survey-scheduling";

export const processSurveySchedulingJob: JobHandler<TSurveySchedulingJobData> = async (data, context) => {
  const logContext = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    maxAttempts: context.maxAttempts,
    queueName: context.queueName,
    scope: data.scope,
  };

  logger.info(logContext, "Survey scheduling reconciliation job started");

  const result = await reconcileDueSurveySchedules({
    logContext,
    now: new Date(),
  });

  logger.info(
    {
      ...logContext,
      pausedCount: result.pausedCount,
      publishedCount: result.publishedCount,
    },
    "Survey scheduling reconciliation job completed"
  );
};
