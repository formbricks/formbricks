import "server-only";
import type { JobHandler, TCreativeStatsFlushJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { flushCreativeCounters } from "./stats-flush";

/** How often creative counters reach Postgres, so the `stats` operation lags by at most about this. */
export const CREATIVE_STATS_FLUSH_INTERVAL_MS = 60_000;

/**
 * Handler for the recurring `creative-stats.flush` job (ENG-4000). A failure fails the job; the next
 * tick flushes the same running totals again, so nothing is lost while Redis keeps them (about two
 * days). Logs at debug level only, since on a busy instance every tick writes something.
 */
export const processCreativeStatsFlushJob: JobHandler<TCreativeStatsFlushJobData> = async (data, context) => {
  const { flushed } = await flushCreativeCounters();

  if (flushed > 0) {
    logger.debug(
      { jobId: context.jobId, jobName: context.jobName, scope: data.scope, flushed },
      "Creative counters flushed"
    );
  }
};
