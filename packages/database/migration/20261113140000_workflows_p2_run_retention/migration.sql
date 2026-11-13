-- Workflows Part 2, run data retention (ENG-7186, ADR 0044). Additive only: two nullable columns on
-- "WorkflowRun" that mark a run whose content the retention job cleared (when, and after how many days),
-- and an index on ("contentDeletedAt", "finishedAt") so each batch finds the runs still to clear
-- (`"contentDeletedAt" IS NULL AND "finishedAt" < cutoff`) without scanning every run. Previous-release
-- pods never select the columns, so a rolling upgrade is safe. Every statement is guarded so the file
-- reruns on a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "contentDeletedAt" TIMESTAMP(3);
ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "contentRetentionDays" INTEGER;

COMMIT;

-- Prisma migrate deploy runs migrations in a transaction, so CREATE INDEX CONCURRENTLY is not available.
-- Run writes wait for the build (SHARE lock); the table holds one row per workflow run, far smaller than
-- the Response tables earlier plain index builds were accepted on.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowRun_contentDeletedAt_finishedAt_idx" ON "WorkflowRun"("contentDeletedAt", "finishedAt");
