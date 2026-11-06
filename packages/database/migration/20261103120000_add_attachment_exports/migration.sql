-- Background attachment exports (ENG-6862): one row per ZIP a job builds into object storage for a
-- presigned download. Additive only: one new enum and one new, empty table. No existing column changes
-- and no data moves. The previous release never reads or writes it, so a rolling upgrade is safe.
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. Every type, table and constraint is created guarded, and the
-- foreign keys are added apart from the table, so the file also converges on a database built with
-- `db:push`.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction. The foreign keys lock "Survey",
-- "Workspace" and "User", all live tables; failing fast beats queueing behind a long-running query.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "AttachmentExportStatus" AS ENUM ('queued', 'running', 'completed', 'failed', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AttachmentExport" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "AttachmentExportStatus" NOT NULL DEFAULT 'queued',
    "filterCriteria" JSONB,
    "timeZone" TEXT NOT NULL,
    "dispatchCount" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "includedFileCount" INTEGER,
    "totalBytes" BIGINT,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "storageKey" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "AttachmentExport_pkey" PRIMARY KEY ("id")
);

-- The table is new and empty, so plain index builds block nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "AttachmentExport_surveyId_requestedById_created_at_idx" ON "AttachmentExport"("surveyId", "requestedById", "created_at");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "AttachmentExport_status_created_at_idx" ON "AttachmentExport"("status", "created_at");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "AttachmentExport_expiresAt_idx" ON "AttachmentExport"("expiresAt");
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "AttachmentExport_workspaceId_idx" ON "AttachmentExport"("workspaceId");

-- One queued or running export per requester and survey. Prisma cannot declare a partial index, so it
-- lives only here; the model's comment points to it. A concurrent second insert fails on this index and
-- the route returns the export already in flight.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "AttachmentExport_surveyId_requestedById_active_key" ON "AttachmentExport"("surveyId", "requestedById") WHERE "status" IN ('queued', 'running');

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "AttachmentExport" ADD CONSTRAINT "AttachmentExport_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "AttachmentExport" ADD CONSTRAINT "AttachmentExport_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "AttachmentExport" ADD CONSTRAINT "AttachmentExport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
