import "server-only";
import type { JobHandler, TDataRetentionSweepJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { type TRetentionSweepers, runDataRetentionSweep } from "./sweep";

/** Each policy's sweeper. A policy without one is left alone. */
export const RETENTION_SWEEPERS: TRetentionSweepers = {};

/**
 * Handler for the recurring `data-retention.sweep` job (ENG-3612): once a night, every organisation's
 * enabled retention policies send their notices and act on what is due, recording each run in History.
 */
export const processDataRetentionSweepJob: JobHandler<TDataRetentionSweepJobData> = async (data, context) => {
  const logContext = { jobId: context.jobId, jobName: context.jobName, scope: data.scope };
  logger.info(logContext, "Data retention sweep started");
  const summary = await runDataRetentionSweep({ sweepers: RETENTION_SWEEPERS });
  logger.info({ ...logContext, ...summary }, "Data retention sweep completed");
};
