-- ENG-3282: survey visibility facts in PostgreSQL, the durable source the SpiceDB projection is built
-- from.
--
-- Every column is additive and defaults to today's behaviour: `visibility = 'workspace'`, no owner,
-- versions equal. A row inserted from here on starts in its initial projection instead (see the
-- trigger below). Nothing here writes a row of a migrated database; `ownerId` is backfilled from `createdBy` by the data
-- migration that follows, BEFORE the projection trigger exists (the migration after that), so the
-- backfill enqueues no outbox events.
--
-- `visibilityPending` ("visibilityVersion" <> "visibilityProjectedVersion") is stored so the visibility
-- predicate stays expressible in Prisma, whose `where` cannot compare two columns. It is an ordinary
-- column kept by a BEFORE trigger rather than a GENERATED one: Prisma cannot declare a generated
-- column, and `db:push` fails on the cross-column default it would need to stay drift-free. A
-- constant `DEFAULT false` also adds the column without rewriting the table. Every existing row has
-- equal versions, so `false` is already correct for it; the recompute below only matters for a
-- database created with `db:push`, which has the column but not the trigger.
--
-- The partial pending index exists only here: Prisma cannot express a partial index and does not drop
-- indexes it does not know, so the schema file declares none and no drift results.

SET lock_timeout = '1s';

-- CreateEnum
-- Guarded rather than bare: idempotent and convergent, including against a `db:push` database.
DO $$
BEGIN
  CREATE TYPE "SurveyVisibility" AS ENUM ('restricted', 'workspace');
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
ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "visibilityPending" BOOLEAN NOT NULL DEFAULT false;

-- Derived, never written by the application: recomputed on every insert and on any update that
-- touches either version (or the column itself, so a stray write cannot stick).
--
-- A new row (a create or a copy) has no graph edges until the projector has run, so it must not look
-- settled: authorization would consult an empty survey node and deny even its owner. Every insert
-- therefore starts in its initial projection: version 0 ("never changed through the visibility
-- endpoint") and acknowledged version -1 ("never acknowledged") — a pair no settled survey can have,
-- distinct from the 0/0 every pre-migration survey carries. The app decides such a row from these
-- PostgreSQL facts until the projector acknowledges version 0; a visibility change stored before that
-- is an ordinary pending change (version 1 and up, still unacknowledged).
CREATE OR REPLACE FUNCTION survey_visibility_pending() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW."visibilityVersion" := 0;
    NEW."visibilityProjectedVersion" := -1;
  END IF;
  NEW."visibilityPending" := NEW."visibilityVersion" <> NEW."visibilityProjectedVersion";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS survey_visibility_pending ON "Survey";
CREATE TRIGGER survey_visibility_pending
  BEFORE INSERT OR UPDATE OF "visibilityVersion", "visibilityProjectedVersion", "visibilityPending"
  ON "Survey"
  FOR EACH ROW EXECUTE FUNCTION survey_visibility_pending();

-- Converges a `db:push` database. Touches no row on a migrated one, where every row already agrees.
UPDATE "Survey"
SET "visibilityPending" = ("visibilityVersion" <> "visibilityProjectedVersion")
WHERE "visibilityPending" <> ("visibilityVersion" <> "visibilityProjectedVersion");

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
-- Not CONCURRENTLY: an interrupted concurrent build leaves an INVALID index that `IF NOT EXISTS` then
-- skips on retry. "Survey" is small (thousands to low hundreds of thousands of rows), so a plain build
-- is brief.
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
