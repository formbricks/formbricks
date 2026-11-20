-- Workflows Part 2, run data retention (ENG-7186, ADR 0044). Additive only: two nullable columns on
-- "WorkflowRun" that mark a run whose content the retention job cleared (when, and after how many days).
-- The ("contentDeletedAt", "finishedAt") index the retention job needs is built concurrently in the next
-- migration, 20261113140001_workflows_p2_run_retention_index. Previous-release pods never select the
-- columns, so a rolling upgrade is safe. Every statement is guarded so the file reruns on a database built
-- with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "contentDeletedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "contentRetentionDays" INTEGER;

COMMIT;
