import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { type DispatchWorkflowRun } from "./dispatch";
import { markWorkflowRunDispatched } from "./mark-dispatched";
import {
  WORKFLOW_RUN_ORPHAN_MAX_AGE_MS,
  WORKFLOW_RUN_ORPHAN_MIN_AGE_MS,
  WORKFLOW_RUN_RECONCILE_BATCH_SIZE,
} from "./reconcile-constants";

interface ReconcileOrphanedWorkflowRunsInput {
  /** Injected so the reconciler stays backend-neutral and unit-testable (same port the producer uses). */
  dispatch: DispatchWorkflowRun;
  /** Injected clock for deterministic age-threshold tests; defaults to wall-clock. */
  now?: Date;
  logContext?: Record<string, unknown>;
}

export interface ReconcileOrphanedWorkflowRunsResult {
  scanned: number;
  redispatched: number;
  agedOutFailed: number;
  /**
   * Of the re-dispatched runs, how many had never been handed off (`dispatchedAt IS NULL`) — genuine
   * producer-side orphans. The remainder were already dispatched but still `queued` (executor lag or a
   * lost job), re-dispatched idempotently. Lets operators tell a producer-dispatch problem from an
   * executor-throughput one.
   */
  neverDispatched: number;
}

/**
 * Periodic reconciler for the **producer-side orphan**: a `WorkflowRun` persisted `queued` whose
 * dispatch never landed (the process died or the Redis enqueue failed after the row was committed —
 * see `createAndDispatchWorkflowRun`). It finds `queued` runs older than the grace window and
 * re-dispatches them through the same idempotent port (`dispatchWorkflowRunViaJobs`, deterministic
 * `jobId = run.id`): a no-op if a job still exists, a genuine recovery if it was lost.
 *
 * - **Scope:** only real runs (`isDryRun: false`); `running` is the sibling sweep's concern
 *   (`reconcile-stuck-running-runs.ts`), and `completed` / `failed` / `canceled` are terminal and never
 *   touched (execution-failure retry is the executor's concern, not the reconciler's).
 * - **Ceiling:** a run still `queued` past `WORKFLOW_RUN_ORPHAN_MAX_AGE_MS` is treated as permanently
 *   un-dispatchable and marked `failed` (bounds the loop; surfaces the stuck run) instead of being
 *   re-dispatched forever.
 * - **Re-dispatch vs. ceiling:** the deterministic `jobId` makes re-dispatch a no-op while a job of
 *   that id is still retained, including a terminally `failed` one. Retention is not absolute:
 *   `removeOnFail` is age 7d *and* `count: 5000` (`packages/jobs/src/constants.ts`), so under a large
 *   failure backlog a failed job can be count-evicted well inside the 24h ceiling, and a later
 *   re-dispatch then genuinely re-runs it instead of leaving it to age out. That re-run is safe —
 *   per-step send idempotency plus the terminal-status guard make it a clean resume or a no-op. So the
 *   boundary is: re-dispatch recovers a run whose job is gone (never created, or evicted) and no-ops
 *   while the job is retained, with the ceiling as the backstop — not an absolute 7d-vs-24h rule. (The
 *   executor marks its own runs terminal on the final attempt, so a job coexisting with a still-`queued`
 *   row is only reachable when claiming never reached the `queued → running` write.)
 * - **Bounded:** one batch per tick; a larger backlog drains over subsequent ticks (re-dispatch is
 *   idempotent, so re-selecting the same still-`queued` run next tick is harmless).
 * - **Safe under concurrency:** every write is status-guarded (`status: "queued"`) so a run claimed
 *   `queued → running` between the scan and the write is never clobbered; and re-dispatch idempotency
 *   means overlapping sweeps cannot double-dispatch.
 * - **Dispatch marker (ENG-1658):** the scan still re-dispatches *every* eligible `queued` run (so a
 *   Redis-loss recovery re-creates all lost jobs via the idempotent port — the `dispatchedAt IS NULL`
 *   fact is deliberately *not* used to filter the scan, which would strand dispatched-but-lost runs).
 *   Instead `dispatchedAt` distinguishes outcomes: a run with `dispatchedAt IS NULL` is a genuine
 *   never-handed-off producer orphan (counted as `neverDispatched`, and stamped on this first
 *   re-dispatch); one with `dispatchedAt` set was already handed off (executor lag or a lost job) and is
 *   re-dispatched idempotently but neither counted nor re-stamped. Gives operators a producer-dispatch
 *   vs executor-throughput signal from a DB fact.
 * - **Isolated:** one run's failure is logged and skipped so it never aborts the sweep.
 */
export const reconcileOrphanedWorkflowRuns = async ({
  dispatch,
  now = new Date(),
  logContext,
}: ReconcileOrphanedWorkflowRunsInput): Promise<ReconcileOrphanedWorkflowRunsResult> => {
  const minAgeThreshold = new Date(now.getTime() - WORKFLOW_RUN_ORPHAN_MIN_AGE_MS);
  const maxAgeThreshold = new Date(now.getTime() - WORKFLOW_RUN_ORPHAN_MAX_AGE_MS);

  // Index-backed by @@index([status, createdAt]); oldest first so a backlog drains deterministically.
  const orphans = await prisma.workflowRun.findMany({
    where: {
      status: "queued",
      isDryRun: false,
      createdAt: { lt: minAgeThreshold },
    },
    orderBy: { createdAt: "asc" },
    take: WORKFLOW_RUN_RECONCILE_BATCH_SIZE,
    select: { id: true, workflowId: true, workspaceId: true, createdAt: true, dispatchedAt: true },
  });

  let redispatched = 0;
  let agedOutFailed = 0;
  let neverDispatched = 0;

  for (const orphan of orphans) {
    const runLogContext = {
      ...logContext,
      workflowRunId: orphan.id,
      workflowId: orphan.workflowId,
      workspaceId: orphan.workspaceId,
    };

    try {
      if (orphan.createdAt < maxAgeThreshold) {
        // Past the ceiling: never re-dispatch forever. Status-guarded so a concurrent claim wins.
        const failed = await prisma.workflowRun.updateMany({
          where: { id: orphan.id, status: "queued" },
          data: {
            status: "failed",
            error: "Workflow run was never dispatched and exceeded the reconcile age ceiling",
            lastErrorAt: now,
            finishedAt: now,
          },
        });
        if (failed.count > 0) {
          agedOutFailed += 1;
          logger.warn(
            { ...runLogContext, createdAt: orphan.createdAt },
            "Orphaned workflow run exceeded reconcile age ceiling; marked failed"
          );
        }
        continue;
      }

      await dispatch({
        workflowRunId: orphan.id,
        workflowId: orphan.workflowId,
        workspaceId: orphan.workspaceId,
      });
      redispatched += 1;

      if (orphan.dispatchedAt === null) {
        // Genuine producer orphan (dispatch never landed): count it, and record this first successful
        // hand-off as a durable DB fact. Already-dispatched-but-still-queued runs (dispatchedAt set) are
        // re-dispatched idempotently above but neither counted nor re-stamped — no churn on the marker.
        neverDispatched += 1;
        await markWorkflowRunDispatched(orphan.id, now, runLogContext);
      }
    } catch (error) {
      // Isolate per run: a single re-dispatch/mark failure must not abort the sweep; the next tick retries.
      logger.error({ ...runLogContext, err: error }, "Failed to reconcile orphaned workflow run");
    }
  }

  return { scanned: orphans.length, redispatched, agedOutFailed, neverDispatched };
};
