import "server-only";
import type { JobHandler, TDeletionCleanupDrainJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { drainDeletionCleanups } from "./drain";

/**
 * Handler for the recurring `deletion-cleanup.drain` job: works through the Hub records and storage files
 * deletes have left behind. Every row it can't finish is rescheduled with backoff, so a run only fails on
 * an infrastructure error, which BullMQ retries; the next tick is the backstop. Logs only when it acted,
 * since most ticks find nothing to do.
 */
export const processDeletionCleanupDrainJob: JobHandler<TDeletionCleanupDrainJobData> = async (
  data,
  context
) => {
  const summary = await drainDeletionCleanups();

  if (summary.done + summary.again + summary.failed > 0) {
    logger.info(
      { jobId: context.jobId, jobName: context.jobName, scope: data.scope, ...summary },
      "Deletion cleanup drain acted"
    );
  }
};
