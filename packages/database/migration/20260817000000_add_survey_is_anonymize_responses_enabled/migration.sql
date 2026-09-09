-- AlterTable
-- Additive only: a new column with a default, so every survey that already exists keeps its current
-- behaviour (anonymize off, capture unchanged). No backfill and no cutover step.
--
-- Wrapped so `lock_timeout` can be SET LOCAL and expire with the transaction rather than leaking
-- into the migrations that follow on the same connection. The statement itself is metadata-only on
-- Postgres 11+ (a default no longer rewrites the table), but it still takes ACCESS EXCLUSIVE on
-- "Survey" for that moment, and queueing for it behind a long read is what turns a fast migration
-- into an outage.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Survey" ADD COLUMN IF NOT EXISTS "is_anonymize_responses_enabled" BOOLEAN NOT NULL DEFAULT false;

COMMIT;
