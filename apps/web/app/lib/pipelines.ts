import { logger } from "@formbricks/logger";
import { enqueuePipelineJob, triggerPipelineDrain } from "@/app/lib/pipeline-queue";
import { TPipelineInput } from "@/app/lib/types/pipelines";

export const sendToPipeline = async (job: TPipelineInput): Promise<void> => {
  try {
    await enqueuePipelineJob(job);
    triggerPipelineDrain();
  } catch (error) {
    logger.error({ error, event: job.event, surveyId: job.surveyId }, "Error queueing pipeline event");
  }
};
