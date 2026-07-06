import "server-only";
import { type JobHandler, type TWorkflowRunReconcileJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { dispatchWorkflowRunViaJobs } from "./dispatch";
import { reconcileOrphanedWorkflowRuns } from "./reconcile-orphaned-runs";

/**
 * Apps/web handler for the recurring `workflow-run.reconcile` BullMQ job. Sweeps for producer-side
 * orphans (queued runs whose dispatch never landed) and re-dispatches them idempotently via the real
 * BullMQ dispatch port. Logs a summary only when it actually acted, to avoid noise from the (common)
 * empty sweep.
 */
export const processWorkflowRunReconcileJob: JobHandler<TWorkflowRunReconcileJobData> = async (
  data,
  context
) => {
  const logContext = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    maxAttempts: context.maxAttempts,
    queueName: context.queueName,
    scope: data.scope,
  };

  const result = await reconcileOrphanedWorkflowRuns({
    dispatch: dispatchWorkflowRunViaJobs,
    now: new Date(),
    logContext,
  });

  if (result.redispatched > 0 || result.agedOutFailed > 0) {
    // Neutral wording: a ceiling-only sweep re-dispatches nothing, so the message must not claim a
    // re-dispatch — the `redispatched` / `agedOutFailed` counts in the payload carry the specifics.
    logger.info({ ...logContext, ...result }, "Workflow run reconciliation acted on orphaned runs");
  } else {
    logger.debug({ ...logContext, ...result }, "Workflow run reconciliation found no orphaned runs");
  }
};
