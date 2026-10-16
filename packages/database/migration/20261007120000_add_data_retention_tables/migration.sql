-- Data retention (ENG-3713, decided in ENG-3697): policies, exemptions, run history, notice and
-- restore markers, plus "User"."reactivatedAt" and "User"."lastActiveAt". Nothing on "Survey" or "Response"
-- changes, because retention must never write the survey row (its "updated_at" is one of the survey
-- clocks).
--
-- One transaction for the whole file. Prisma 7.8 does not add one, and these statements only make
-- sense together: a partial apply would leave tables standing without their constraints or foreign
-- keys. It is also what makes the file rerunnable — a rollback leaves nothing behind to collide with
-- on the retry. Every type and constraint is created guarded, and the CHECKs and foreign keys are
-- added apart from their tables, so the file also converges on a database built with `db:push`,
-- which has the tables but none of the CHECKs.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into whichever
-- migrations run after this one on the same connection. The foreign keys at the bottom lock
-- "Organization", "Survey" and "User", which are live tables; failing fast is better than queueing
-- behind a long-running query and holding the lock queue open behind us.
--
-- The CHECK constraints hold the structural invariants Prisma cannot express: positive day counts,
-- conditions on the surveys policy only (and at least one there), exactly one target per exemption and
-- notice, a reason on every person's exemption, and a reason on every skipped run item, plus the two
-- range bounds that guard against acting early (a notice of at least 14 days, shorter than the period).
-- The other ranges are validated by the API, because they are expected to widen. Prisma neither models nor drops CHECK constraints, so they cause no schema drift.
-- A guard that finds a type or constraint already there keeps it as it is: a development database that
-- applied an earlier draft of this unreleased file keeps that draft's definitions. Reset it instead.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionEntity" AS ENUM ('responses', 'surveys', 'members');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionSurveyCondition" AS ENUM ('noResponse', 'noChange', 'createdBefore');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionRunKind" AS ENUM ('sweep', 'purge');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionExemptionSource" AS ENUM ('manual', 'restore');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionTargetType" AS ENUM ('survey', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionRunItemAction" AS ENUM ('notified', 'archived', 'deactivated', 'deleted', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "RetentionSkipReason" AS ENUM ('exempt', 'lastOwner', 'otherOrganization', 'noRecipient');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionPolicy" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" "RetentionEntity" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledAt" TIMESTAMP(3),
    "warnDays" INTEGER NOT NULL DEFAULT 60,
    "periodDays" INTEGER NOT NULL,
    "conditions" "RetentionSurveyCondition"[] DEFAULT ARRAY[]::"RetentionSurveyCondition"[],
    "deferredAt" TIMESTAMP(3),
    "updatedById" TEXT,

    CONSTRAINT "RetentionPolicy_pkey" PRIMARY KEY ("id")
);

-- The 14-day notice floor and a notice shorter than the period are product rules the API enforces;
-- they are repeated here as backstops for system writers (the sweep moves `enabledAt`): a shorter
-- warning could delete early, and one as long as the period would re-send a notice after any
-- activity. An enabled policy always knows when it took effect.
DO $$
BEGIN
  ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_days_check" CHECK ("warnDays" >= 14 AND "periodDays" > "warnDays");
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_enabled_at_check" CHECK (NOT "enabled" OR "enabledAt" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_conditions_check" CHECK (CASE WHEN "entity" = 'surveys' THEN COALESCE(cardinality("conditions"), 0) >= 1 ELSE COALESCE(cardinality("conditions"), 0) = 0 END);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionExemption" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" TEXT NOT NULL,
    "entity" "RetentionEntity" NOT NULL,
    "surveyId" TEXT,
    "until" TIMESTAMP(3) NOT NULL,
    "source" "RetentionExemptionSource" NOT NULL DEFAULT 'manual',
    "reason" TEXT,
    "createdById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "RetentionExemption_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_target_check" CHECK (num_nonnulls("surveyId") = 1);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_entity_check" CHECK ("entity" IN ('surveys', 'responses'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_revoked_check" CHECK ("revokedById" IS NULL OR "revokedAt" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- A person's exemption carries their reason; one a restore made carries none (the app labels it).
DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_reason_check" CHECK (("source" = 'manual') = ("reason" IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
-- When each survey was last restored from the archive: it starts the surveys policy's "no response" and
-- "no change" periods over. Kept apart from "Survey" so retention adds nothing to the survey row.
CREATE TABLE IF NOT EXISTS "RetentionSurveyRestore" (
    "surveyId" TEXT NOT NULL,
    "restoredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RetentionSurveyRestore_pkey" PRIMARY KEY ("surveyId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" "RetentionEntity" NOT NULL,
    "kind" "RetentionRunKind" NOT NULL DEFAULT 'sweep',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "notifiedCount" INTEGER NOT NULL DEFAULT 0,
    "archivedCount" INTEGER NOT NULL DEFAULT 0,
    "deletedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "hasChanges" BOOLEAN NOT NULL DEFAULT false,
    "scanCursor" TEXT,

    CONSTRAINT "RetentionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionRunItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "targetType" "RetentionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetName" TEXT,
    "action" "RetentionRunItemAction" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "recipient" TEXT,
    "skipReason" "RetentionSkipReason",

    CONSTRAINT "RetentionRunItem_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "RetentionRunItem" ADD CONSTRAINT "RetentionRunItem_count_check" CHECK ("count" > 0);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionRunItem" ADD CONSTRAINT "RetentionRunItem_skip_reason_check" CHECK (("action" = 'skipped') = ("skipReason" IS NOT NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetentionNotice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "entity" "RetentionEntity" NOT NULL,
    "surveyId" TEXT,
    "userId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "emailSent" BOOLEAN NOT NULL DEFAULT false,
    "claimToken" TEXT,
    "clockAt" TIMESTAMP(3),

    CONSTRAINT "RetentionNotice_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "RetentionNotice" ADD CONSTRAINT "RetentionNotice_target_check" CHECK (("entity" IN ('surveys', 'responses') AND "surveyId" IS NOT NULL AND "userId" IS NULL) OR ("entity" = 'members' AND "userId" IS NOT NULL AND "surveyId" IS NULL));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "RetentionNotice" ADD CONSTRAINT "RetentionNotice_email_check" CHECK (NOT "emailSent" OR "deliveredAt" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Every index below is on a table this same transaction just created, so it is built over zero rows
-- and locks nothing anyone else can reach. CONCURRENTLY is not an option here in any case: Postgres
-- rejects it inside a transaction block, and the transaction is what keeps the tables and their
-- foreign keys from being applied apart.

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionPolicy_updatedById_idx" ON "RetentionPolicy"("updatedById");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionPolicy_organizationId_entity_key" ON "RetentionPolicy"("organizationId", "entity");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionExemption_organizationId_created_at_id_idx" ON "RetentionExemption"("organizationId", "created_at", "id");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionExemption_surveyId_idx" ON "RetentionExemption"("surveyId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionExemption_createdById_idx" ON "RetentionExemption"("createdById");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionExemption_revokedById_idx" ON "RetentionExemption"("revokedById");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionRun_organizationId_startedAt_id_idx" ON "RetentionRun"("organizationId", "startedAt", "id");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionRunItem_runId_id_idx" ON "RetentionRunItem"("runId", "id");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionRunItem_targetId_idx" ON "RetentionRunItem"("targetId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "RetentionNotice_organizationId_idx" ON "RetentionNotice"("organizationId");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionNotice_surveyId_entity_key" ON "RetentionNotice"("surveyId", "entity");

-- CreateIndex
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionNotice_userId_organizationId_entity_key" ON "RetentionNotice"("userId", "organizationId", "entity");

-- One active exemption per survey and policy. Partial, so Prisma cannot declare it (see "Indexes
-- Prisma cannot express" in the package README): `RetentionExemption` deliberately has no matching
-- `@@unique`. "Active" also needs `until > now()`, which no index predicate can hold, so an expired
-- row keeps this slot until it is revoked; creating a new exemption closes the expired one first.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "RetentionExemption_surveyId_entity_active_key" ON "RetentionExemption"("surveyId", "entity") WHERE "revokedAt" IS NULL;

-- Each foreign key below points *out* of a table this transaction just created, so the validating
-- scan reads zero rows and NOT VALID would defer nothing. What the statements do cost is a brief
-- lock on the referenced side ("Organization", "Survey", "User"), which the SET LOCAL above bounds.

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionPolicy" ADD CONSTRAINT "RetentionPolicy_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionSurveyRestore" ADD CONSTRAINT "RetentionSurveyRestore_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionExemption" ADD CONSTRAINT "RetentionExemption_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionRun" ADD CONSTRAINT "RetentionRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionRunItem" ADD CONSTRAINT "RetentionRunItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "RetentionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionNotice" ADD CONSTRAINT "RetentionNotice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionNotice" ADD CONSTRAINT "RetentionNotice_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "RetentionNotice" ADD CONSTRAINT "RetentionNotice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
-- Last, right before COMMIT: adding a column takes ACCESS EXCLUSIVE on "User", which blocks every
-- session lookup until the transaction ends, and a request for it queues every read of "User" behind
-- it while it waits, so it gives up after a second rather than the five allowed above. Taken earlier, it would be held while the foreign keys
-- above wait (up to the SET LOCAL timeout each) for their locks on "Organization" and "Survey". Both
-- columns are nullable with no default, a catalog-only change that rewrites nothing.
SET LOCAL lock_timeout = '1s';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "reactivatedAt" TIMESTAMP(3);

-- The members retention clock's record of activity, written on every completed sign-in and session
-- renewal. It is seeded from the last sign-in and the sessions still valid by the data migration right after this one
-- (`20261007120001_backfill_user_last_active_at`), in batches that each commit on their own, rather than
-- here, where it would hold this transaction's lock on "User" for the whole pass.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActiveAt" TIMESTAMP(3);

COMMIT;
