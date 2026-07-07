import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import {
  WORKFLOW_RUN_RECONCILE_BATCH_SIZE,
  WORKFLOW_RUN_STUCK_RUNNING_MAX_AGE_MS,
} from "./reconcile-constants";

interface ReconcileStuckRunningWorkflowRunsInput {
  /** Injected clock for deterministic staleness-threshold tests; defaults to wall-clock. */
  now?: Date;
  logContext?: Record<string, unknown>;
}

export interface ReconcileStuckRunningWorkflowRunsResult {
  scanned: number;
  recovered: number;
  stepsSkipped: number;
}

/**
 * Periodic reconciler for the **execution-side orphan**: a `WorkflowRun` stuck `running` after the
 * executor crashed/stalled between claiming a step (`WorkflowRunLog` row → `running`, written BEFORE
 * the send) and recording its result. Once that happens the run is wedged: every BullMQ redelivery
 * sees the `running` step row and bails (`STEP_BAIL`, at-most-once — never re-send), the job completes
 * without error so no retry fires, and nothing moves the run to a terminal state. This is the
 * "future orphan-reconciler" the executor defers to (see `process-workflow-run-job.ts`).
 *
 * - **Staleness by `updatedAt`, not `startedAt`:** the executor never touches the run row between the
 *   claim and the terminal write, and a non-final failure bumps `updatedAt` while keeping status
 *   `running`. So "`running` with no `updatedAt` movement for `WORKFLOW_RUN_STUCK_RUNNING_MAX_AGE_MS`"
 *   means no executor activity at all — including no in-flight retry (the whole attempts×backoff
 *   window is ≲1 min, far inside the 1h threshold), so no live owner can be racing.
 * - **Recover, don't resume:** a stuck run cannot be re-run — its `running` step rows block every
 *   claim path (a `running` step bails; after this sweep a `skipped` step matches no re-claim
 *   condition either). The send may or may not have gone out, so we surface the failure rather than
 *   guess. Recovery = mark the run `failed` (distinct error) so redeliveries no-op on the executor's
 *   pre-claim terminal-status check.
 * - **Steps → `skipped`, never `failed`:** the executor re-claims a `failed` step and re-sends it, so
 *   `failed` here would re-arm a double-send and break at-most-once. `skipped` records "outcome
 *   unknown, not retried" and matches no claim path.
 * - **Run-first, then steps:** the run is claimed-for-failure with a status-guarded `updateMany`
 *   (`status: "running"`); only when we win (`count > 0`) do we touch its steps — so we never skip
 *   the steps of a run a live owner still holds. A crash between the two writes leaves a `failed` run
 *   with `running` step rows: cosmetic only, since the terminal-status guard makes those steps
 *   unreachable forever.
 * - **Benign overwrite race:** `sendOwnedStep` finalizes a step with an unconditional write by
 *   `(runId, stepId)`. If an impossibly-slow owner finalizes a step *after* we skipped it, its true
 *   outcome overwrites our `skipped` — harmless, and combined with the guarded run terminal writes
 *   (which reject clobbering a `failed` run) every interleaving still yields zero double-sends.
 * - **`data.steps` mirror not reconstructed:** the run's denormalized step mirror is left as-is; the
 *   authoritative per-step record is the `WorkflowRunLog` rows this sweep marks `skipped`.
 * - **Bounded / isolated:** one batch per tick, oldest-first; one run's failure is logged and skipped
 *   so it never aborts the sweep. Running-state cardinality is tiny, so a backlog is not expected.
 */
export const reconcileStuckRunningWorkflowRuns = async ({
  now = new Date(),
  logContext,
}: ReconcileStuckRunningWorkflowRunsInput): Promise<ReconcileStuckRunningWorkflowRunsResult> => {
  const staleThreshold = new Date(now.getTime() - WORKFLOW_RUN_STUCK_RUNNING_MAX_AGE_MS);

  // Index-assisted by @@index([status, createdAt]) on the `status = 'running'` prefix; running-state
  // cardinality is tiny (executions are seconds long), so the residual `updatedAt` filter + sort are
  // cheap. Oldest first so the longest-stuck runs are surfaced first.
  const stuck = await prisma.workflowRun.findMany({
    where: {
      status: "running",
      isDryRun: false,
      updatedAt: { lt: staleThreshold },
    },
    orderBy: { updatedAt: "asc" },
    take: WORKFLOW_RUN_RECONCILE_BATCH_SIZE,
    select: { id: true, workflowId: true, workspaceId: true, startedAt: true, updatedAt: true },
  });

  let recovered = 0;
  let stepsSkipped = 0;

  for (const run of stuck) {
    const runLogContext = {
      ...logContext,
      workflowRunId: run.id,
      workflowId: run.workflowId,
      workspaceId: run.workspaceId,
    };

    try {
      // Claim-for-failure, status-guarded: only a run still `running` is ours to recover. A 0-row
      // result means the owner finalized it between the scan and here — leave its verdict alone.
      const failed = await prisma.workflowRun.updateMany({
        where: { id: run.id, status: "running" },
        data: {
          status: "failed",
          error: "Workflow run was abandoned mid-execution (stale running) and recovered by the reconciler",
          lastErrorAt: now,
          finishedAt: now,
        },
      });

      if (failed.count === 0) {
        continue;
      }

      recovered += 1;

      // Only after we own the failure: flip the orphaned in-flight steps to `skipped` (never `failed`,
      // which the executor would re-claim and re-send). 0 is legitimate — a crash before the first
      // step was ever claimed leaves no `running` step rows.
      const skipped = await prisma.workflowRunLog.updateMany({
        where: { runId: run.id, status: "running" },
        data: {
          status: "skipped",
          error: "Step outcome unknown: run abandoned mid-execution; not retried (at-most-once)",
          finishedAt: now,
        },
      });
      stepsSkipped += skipped.count;

      logger.warn(
        {
          ...runLogContext,
          startedAt: run.startedAt,
          updatedAt: run.updatedAt,
          stepsSkipped: skipped.count,
        },
        "Stuck running workflow run recovered; marked failed"
      );
    } catch (error) {
      // Isolate per run: a single recovery failure must not abort the sweep; the next tick retries.
      logger.error({ ...runLogContext, err: error }, "Failed to recover stuck running workflow run");
    }
  }

  return { scanned: stuck.length, recovered, stepsSkipped };
};
