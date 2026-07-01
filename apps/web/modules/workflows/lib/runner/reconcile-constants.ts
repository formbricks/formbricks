// Tuning for the workflow-run orphan reconciler (workflow-run.reconcile recurring job).

/** Recurring-schedule identity (a single global sweep, mirroring survey-scheduling). */
export const WORKFLOW_RUN_RECONCILE_GLOBAL_SCOPE = "global";
export const WORKFLOW_RUN_RECONCILE_SCHEDULE_ID = "workflow-run-reconcile";

/** How often the sweep runs. Orphans are rare, so a few minutes balances recovery latency vs. churn. */
export const WORKFLOW_RUN_RECONCILE_INTERVAL_MS = 3 * 60 * 1000;

/**
 * Grace window: a run younger than this may still be mid-dispatch in the producer (or its response-
 * pipeline retry), so it is not yet considered orphaned. Must exceed normal dispatch + pipeline-retry
 * latency.
 */
export const WORKFLOW_RUN_ORPHAN_MIN_AGE_MS = 2 * 60 * 1000;

/**
 * Ceiling: a run still `queued` past this is treated as permanently un-dispatchable and marked
 * `failed` (bounding the re-dispatch loop and surfacing the stuck run) instead of being re-dispatched
 * forever.
 */
export const WORKFLOW_RUN_ORPHAN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Max orphans handled per tick. A larger backlog drains over subsequent ticks (re-dispatch is idempotent). */
export const WORKFLOW_RUN_RECONCILE_BATCH_SIZE = 250;
