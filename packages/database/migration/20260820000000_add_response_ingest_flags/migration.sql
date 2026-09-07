-- AlterTable
-- Additive only: a nullable column with no default, so every response that already exists keeps its
-- current shape and there is nothing to backfill. Null means "no ingest boundary has written this",
-- which is deliberately distinct from an empty list ("ingested, nothing flagged").
--
-- Wrapped so `lock_timeout` can be SET LOCAL and expire with the transaction rather than leaking
-- into the migrations that follow on the same connection. The statement is metadata-only, but
-- "Response" is the largest table in the schema and the busiest, so the ACCESS EXCLUSIVE lock it
-- takes for that moment is the part worth bounding.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "ingest_flags" JSONB;

COMMIT;
