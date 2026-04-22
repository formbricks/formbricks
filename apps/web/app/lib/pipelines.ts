import { getBackgroundJobProducer } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { TPipelineInput } from "@/app/lib/types/pipelines";
import { getJobsQueueingConfig } from "@/lib/jobs/config";

export const sendToPipeline = async (job: TPipelineInput): Promise<void> => {
  try {
    const jobsQueueingConfig = getJobsQueueingConfig();
    if (!jobsQueueingConfig.enabled) {
      throw new Error("BullMQ response pipeline queueing is not enabled");
    }

    const producer = getBackgroundJobProducer();
    await producer.enqueueResponsePipeline(job);
  } catch (error) {
    logger.error(
      { error, event: job.event, surveyId: job.surveyId, workspaceId: job.workspaceId },
      "Error queueing pipeline event"
    );
    throw error;
  }
};
