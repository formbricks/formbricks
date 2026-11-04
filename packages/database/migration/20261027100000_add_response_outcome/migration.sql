-- CreateEnum + AlterTable
-- Additive only: a nullable column with no default, so every response that already exists keeps its
-- current shape and there is nothing to backfill. Null means "no outcome"; `lowQuality` is the only
-- value, set by a reviewer (ENG-6780). No index: the column is only filtered inside a survey's own
-- responses, which the existing `surveyId` indexes already narrow.
--
-- The type is created guarded so the file reruns cleanly. Wrapped so `lock_timeout` is SET LOCAL and
-- expires with the transaction: the column add is metadata-only, but "Response" is the busiest table in
-- the schema and the ACCESS EXCLUSIVE lock it takes for that moment is the part worth bounding.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  CREATE TYPE "ResponseOutcome" AS ENUM ('lowQuality');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "outcome" "ResponseOutcome";

COMMIT;
