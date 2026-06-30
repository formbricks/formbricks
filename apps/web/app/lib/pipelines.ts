import { TResponsePipelineJobData, getBackgroundJobProducer } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import type { TUserLocale } from "@formbricks/types/user";
import { getJobsQueueingConfig } from "@/lib/jobs/config";
import { findMatchingLocale } from "@/lib/utils/locale";

export const sendToPipeline = async (job: TResponsePipelineJobData): Promise<void> => {
  try {
    const jobsQueueingConfig = getJobsQueueingConfig();
    if (!jobsQueueingConfig.enabled) {
      throw new Error("BullMQ response pipeline queueing is not enabled");
    }

    // Resolve the locale here (request scope) so the worker can localize follow-up emails
    // without calling headers()/cookies(), which are unavailable outside a request.
    let locale: TUserLocale | undefined = job.locale;
    if (!locale) {
      try {
        locale = await findMatchingLocale();
      } catch {
        locale = undefined;
      }
    }

    const producer = getBackgroundJobProducer();
    await producer.enqueueResponsePipeline({ ...job, locale });
  } catch (error) {
    logger.error(
      { error, event: job.event, surveyId: job.surveyId, workspaceId: job.workspaceId },
      "Error queueing pipeline event"
    );
    throw error;
  }
};
