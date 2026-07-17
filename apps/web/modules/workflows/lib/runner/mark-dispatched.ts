import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";

/**
 * Records that a `WorkflowRun` was handed off to the task backend, as a durable DB fact (ENG-1658).
 * Stamped by the producer and the reconciler right after a successful dispatch — never inside the
 * backend-specific dispatch port — so recovery can distinguish a genuine never-dispatched producer
 * orphan (`dispatchedAt IS NULL`) from a dispatched-but-still-queued run, without inferring it from the
 * queue's jobId-dedup semantics.
 *
 * Best-effort by design: the dispatch has already succeeded, so a failed marker write must not surface
 * as a dispatch failure or abort a fan-out / sweep. A missed stamp self-heals on the next reconcile
 * tick, which re-stamps after its own idempotent re-dispatch. Errors are logged, never thrown.
 */
export const markWorkflowRunDispatched = async (
  workflowRunId: string,
  dispatchedAt: Date,
  logContext?: Record<string, unknown>
): Promise<void> => {
  try {
    await prisma.workflowRun.update({
      where: { id: workflowRunId },
      data: { dispatchedAt },
    });
  } catch (error) {
    logger.error(
      { ...logContext, workflowRunId, err: error },
      "Workflow run dispatched but recording dispatchedAt failed; the reconciler will heal the marker"
    );
  }
};
