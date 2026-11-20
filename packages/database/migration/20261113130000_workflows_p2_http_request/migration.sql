-- Workflows Part 2, HTTP request (ENG-7179, ADR 0043). Additive only: a new "WorkflowSecret" table for
-- encrypted secret header values. The "WorkflowRunLog" ("status", "startedAt") index the reconciler needs
-- is built concurrently in the next migration, 20261113130001_workflows_p2_run_log_status_index.
-- Previous-release pods never read the table, so a rolling upgrade is safe. Every statement is guarded so
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
