-- Workflows Part 2, Webhook trigger (ENG-7177, ADRs 0041 and 0048). Additive only: two nullable columns on
-- "Workflow" for the Webhook Secret URL token (a hash to check calls, an encrypted copy so the editor can
-- show the URL again), a nullable "callerIp" on "WorkflowRun", and a new "WorkflowSample" table for
-- per-call data, so a call never writes to "Workflow" and never bumps its "updated_at". Previous-release
-- pods never select any of these, so a rolling upgrade is safe. Every statement is guarded so the file
-- reruns on a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "webhookTokenHash" TEXT;
ALTER TABLE "Workflow" ADD COLUMN IF NOT EXISTS "webhookTokenEncrypted" TEXT;

ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "callerIp" TEXT;

CREATE TABLE IF NOT EXISTS "WorkflowSample" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sample" JSONB NOT NULL,
    "lastCalledAt" TIMESTAMP(3),
    "lastCallerIp" TEXT,
    CONSTRAINT "WorkflowSample_pkey" PRIMARY KEY ("id")
);

-- The table is new and empty, so plain index builds block nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowSample_workflowId_source_key" ON "WorkflowSample"("workflowId", "source");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowSample_workflowId_workspaceId_idx" ON "WorkflowSample"("workflowId", "workspaceId");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "WorkflowSample_updated_at_idx" ON "WorkflowSample"("updated_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowSample_workflowId_workspaceId_fkey'
  ) THEN
    ALTER TABLE "WorkflowSample"
      ADD CONSTRAINT "WorkflowSample_workflowId_workspaceId_fkey"
      FOREIGN KEY ("workflowId", "workspaceId") REFERENCES "Workflow"("id", "workspaceId")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

COMMIT;
