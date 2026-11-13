-- Workflows Part 2, HTTP request (ENG-7179, ADR 0043). Additive only: a new "WorkflowSecret" table for
-- encrypted secret header values, and an index on "WorkflowRunLog" ("status", "startedAt") so the
-- reconciler can find "Don't wait" calls still sending after an hour without scanning every step log.
-- Previous-release pods never read either, so a rolling upgrade is safe. Every statement is guarded so
-- the file reruns on a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS "WorkflowSecret" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "WorkflowSecret_pkey" PRIMARY KEY ("id")
);

-- The table is new and empty, so a plain index build blocks nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowSecret_workflowId_workspaceId_idx" ON "WorkflowSecret"("workflowId", "workspaceId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowSecret_workflowId_workspaceId_fkey'
  ) THEN
    ALTER TABLE "WorkflowSecret"
      ADD CONSTRAINT "WorkflowSecret_workflowId_workspaceId_fkey"
      FOREIGN KEY ("workflowId", "workspaceId") REFERENCES "Workflow"("id", "workspaceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;

-- Prisma migrate deploy runs migrations in a transaction, so CREATE INDEX CONCURRENTLY is not available.
-- Step log writes wait for the build (SHARE lock); the table holds one row per workflow step run, far
-- smaller than the Response tables earlier plain index builds were accepted on.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowRunLog_status_startedAt_idx" ON "WorkflowRunLog"("status", "startedAt");
