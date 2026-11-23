// Tuning for the workflow run retention job (workflow-run.retention recurring job, ENG-7186, ADR 0044).
// The schedule's identity (name, scheduleId, scope) belongs to its declaration in @formbricks/jobs; the
// retention period itself is `WORKFLOW_RUN_DATA_RETENTION_DAYS`.

/** Hourly: each tick is bounded, so a backlog (the first run after an upgrade) drains over a few hours. */
export const WORKFLOW_RUN_RETENTION_INTERVAL_MS = 60 * 60 * 1000;

/** Rows per batch. Each batch is one short transaction, so no lock is held for long. */
export const WORKFLOW_RUN_RETENTION_BATCH_SIZE = 500;

/** Batches per kind (run content, Test runs, samples) per tick: at most 10,000 rows of each per hour. */
export const WORKFLOW_RUN_RETENTION_MAX_BATCHES_PER_TICK = 20;

/** Test runs are deleted entirely this many days after they started, whatever the retention period. */
export const WORKFLOW_TEST_RUN_RETENTION_DAYS = 7;
