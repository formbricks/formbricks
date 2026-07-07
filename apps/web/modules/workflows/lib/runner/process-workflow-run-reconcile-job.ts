import "server-only";
import { type JobHandler, type TWorkflowRunReconcileJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { dispatchWorkflowRunViaJobs } from "./dispatch";
import { reconcileOrphanedWorkflowRuns } from "./reconcile-orphaned-runs";
import { reconcileStuckRunningWorkflowRuns } from "./reconcile-stuck-running-runs";

/**
 * Apps/web handler for the recurring `workflow-run.reconcile` BullMQ job. Runs both runner
 * reconcilers against one shared clock: the **producer-side** sweep re-dispatches `queued` runs whose
 * dispatch never landed (idempotent, via the real BullMQ port), and the **execution-side** sweep
 * marks stale `running` runs `failed` (crash between step claim and send). Logs a summary only when it
 * actually acted, to avoid noise from the (common) empty sweep. A thrown scan fails the job so BullMQ
 * retries; the recurring schedule is the backstop.
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

  const now = new Date();

  // Independent sweeps (disjoint status sets: `queued` vs `running`), so run them concurrently. If one
  // rejects the job fails and BullMQ retries; the sibling's work is not cancelled (its writes are
  // idempotent/guarded, so a retried tick redoing them is harmless).
  const [queued, stuckRunning] = await Promise.all([
    reconcileOrphanedWorkflowRuns({ dispatch: dispatchWorkflowRunViaJobs, now, logContext }),
    reconcileStuckRunningWorkflowRuns({ now, logContext }),
  ]);

  const acted = queued.redispatched > 0 || queued.agedOutFailed > 0 || stuckRunning.recovered > 0;

  if (acted) {
    // Neutral wording: the action may be a re-dispatch, an age-out, or a stuck-running recovery — the
    // per-sweep counts in the payload carry the specifics, so the message claims none of them.
    logger.info({ ...logContext, queued, stuckRunning }, "Workflow run reconciliation acted");
  } else {
    logger.debug(
      { ...logContext, queued, stuckRunning },
      "Workflow run reconciliation found nothing to reconcile"
    );
  }
};
