-- ENG-3282: survey visibility facts in PostgreSQL, the durable source the SpiceDB projection is built
-- from.
--
-- Every column is additive and defaults to today's behaviour: `visibility = 'workspace'`, no owner,
-- versions equal. Nothing here writes a row; `ownerId` is backfilled from `createdBy` by the data
-- migration that follows, BEFORE the projection trigger exists (the migration after that), so the
-- backfill enqueues no outbox events.
--
-- `visibilityPending` is a STORED generated column so the visibility predicate stays expressible in
-- Prisma (`where` cannot compare two columns). Adding a stored generated column rewrites the table
-- under an ACCESS EXCLUSIVE lock. "Survey" is small (thousands to low hundreds of thousands of rows),
-- so the rewrite is accepted; `lock_timeout` keeps it from queueing behind a long transaction — if it
-- fires, rerun the migration. Prisma declares it optional and default-less, so it never writes it.
--
-- The partial pending index exists only here: Prisma cannot express a partial index and does not drop
-- indexes it does not know, so the schema file declares none and no drift results.

SET lock_timeout = '1s';

-- CreateEnum
-- Guarded rather than bare: idempotent and convergent, including against a `db:push` database.
DO $$
BEGIN
  CREATE TYPE "SurveyVisibility" AS ENUM ('private', 'workspace');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibility" "SurveyVisibility" NOT NULL DEFAULT 'workspace';
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "ownerId" TEXT;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityProjectedVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityChangedAt" TIMESTAMP(3);
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityChangedById" TEXT;
-- The table rewrite is accepted; see the header.
-- squawk-ignore adding-field-with-default
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityPending" BOOLEAN GENERATED ALWAYS AS ("visibilityVersion" <> "visibilityProjectedVersion") STORED;

-- AddForeignKey
-- NOT VALID then VALIDATE: the column was added above with no values, so validation scans nothing
-- that can fail, and it runs under a lock that does not block writes.
DO $$
BEGIN
  ALTER TABLE "Survey" ADD CONSTRAINT "Survey_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
-- VALIDATE is idempotent: rerunning it against an already-valid constraint is a no-op.
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Survey" VALIDATE CONSTRAINT "Survey_ownerId_fkey";

-- CreateIndex
-- Not CONCURRENTLY. The table was just rewritten under an exclusive lock for the generated column, so
-- a concurrent build buys nothing here, and an interrupted concurrent build would leave an INVALID
-- index that `IF NOT EXISTS` then skips on retry.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Survey_workspaceId_ownerId_idx" ON "Survey"("workspaceId", "ownerId");

-- Only surveys with a visibility change in flight: the repair sweep's lookup.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "Survey_visibility_pending_idx" ON "Survey"("workspaceId") WHERE "visibilityPending";

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuthzedProjectionScopeState" (
    "scope" TEXT NOT NULL,
    "readyAt" TIMESTAMP(3),
    "readyBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthzedProjectionScopeState_pkey" PRIMARY KEY ("scope")
);

RESET lock_timeout;
