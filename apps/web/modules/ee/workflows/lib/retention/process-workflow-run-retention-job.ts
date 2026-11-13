import "server-only";
import { type JobHandler, type TGlobalScopeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { env } from "@/lib/env";
import { runWorkflowRunRetention } from "./run-retention";

/**
 * Apps/web handler for the recurring `workflow-run.retention` BullMQ job (ENG-7186, ADR 0044). Runs for
 * every instance, licensed or not: data that has to expire expires whatever the plan. A thrown batch fails
 * the job so BullMQ retries; every batch already committed stays committed, and the next tick picks up
 * where this one stopped.
 */
export const processWorkflowRunRetentionJob: JobHandler<TGlobalScopeJobData> = async (data, context) => {
  const retentionDays = env.WORKFLOW_RUN_DATA_RETENTION_DAYS;
  const result = await runWorkflowRunRetention({ now: new Date(), retentionDays });

  const logPayload = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    queueName: context.queueName,
    scope: data.scope,
    retentionDays,
    ...result,
  };

  if (result.runContentCleared > 0 || result.testRunsDeleted > 0 || result.samplesDeleted > 0) {
    logger.info(logPayload, "Workflow run retention cleared expired run data");
  } else {
    logger.debug(logPayload, "Workflow run retention found nothing to clear");
  }
};
