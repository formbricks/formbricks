-- CreateEnum
CREATE TYPE "FeedbackSourceElementScope" AS ENUM ('all', 'specific');

-- AlterTable
-- Existing sources default to 'specific' so their behaviour does not change: reconciliation will not
-- add mappings for questions added after they were connected until an operator next saves the source,
-- at which point the scope is derived from the selection they submit. Backfilling to 'all' would have
-- to guess, and guessing wrong pushes questions the operator deliberately excluded into the dataset.
ALTER TABLE "FeedbackSource" ADD COLUMN "elementScope" "FeedbackSourceElementScope" NOT NULL DEFAULT 'specific';
