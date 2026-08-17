-- AlterTable
-- Additive only: a new column with a default, so every survey that already exists keeps its current
-- behaviour (anonymize off, capture unchanged). No backfill and no cutover step.
ALTER TABLE "Survey" ADD COLUMN     "is_anonymize_responses_enabled" BOOLEAN NOT NULL DEFAULT false;
