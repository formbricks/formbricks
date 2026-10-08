-- Work left over after a delete commits: Hub records and storage files (ENG-3612). A new, empty table
-- with no foreign keys, so nothing else is locked or rewritten. The type and the CHECKs are created
-- guarded and apart from the table, so the file reruns cleanly and converges on a `db:push` database,
-- which has the table but not the CHECKs that keep a cleanup from widening.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "DeletionCleanupKind" AS ENUM ('hubSurvey', 'hubResponses', 'storageFiles', 'storageSurveyFolder');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "DeletionCleanup" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "kind" "DeletionCleanupKind" NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "tenantIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "responseIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fileKeys" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,

    CONSTRAINT "DeletionCleanup_pkey" PRIMARY KEY ("id")
);

-- A survey cleanup never names responses (it would otherwise read as "only these"), a responses
-- cleanup always does (an empty list must never widen to the whole survey), and a storage cleanup
-- always names its files. Every side is NULL-safe: `cardinality(NULL) > 0` is NULL, which a CHECK
-- would let through.
DO $$
BEGIN
  ALTER TABLE "DeletionCleanup" ADD CONSTRAINT "DeletionCleanup_kind_check" CHECK (
      ("kind" = 'hubSurvey' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
      OR ("kind" = 'hubResponses' AND COALESCE(cardinality("responseIds"), 0) > 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
      OR ("kind" = 'storageFiles' AND COALESCE(cardinality("fileKeys"), 0) > 0 AND COALESCE(cardinality("responseIds"), 0) = 0)
      OR ("kind" = 'storageSurveyFolder' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The lists are never NULL (the drain reads each as an array) and the ids never empty: a storage
-- delete builds its prefix from them, so an empty id would widen it. A CHECK rather than NOT NULL on
-- the lists, which Prisma models as nullable list columns and would otherwise report as drift.
DO $$
BEGIN
  ALTER TABLE "DeletionCleanup" ADD CONSTRAINT "DeletionCleanup_values_check" CHECK (
      "tenantIds" IS NOT NULL AND "responseIds" IS NOT NULL AND "fileKeys" IS NOT NULL
      AND length("organizationId") > 0 AND length("workspaceId") > 0 AND length("surveyId") > 0
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex
-- The table was created by this same transaction, so the index is built over zero rows.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "DeletionCleanup_nextAttemptAt_idx" ON "DeletionCleanup"("nextAttemptAt");

COMMIT;
