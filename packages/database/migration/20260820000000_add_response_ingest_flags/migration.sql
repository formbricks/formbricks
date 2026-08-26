-- AlterTable
-- Additive only: a nullable column with no default, so every response that already exists keeps its
-- current shape and there is nothing to backfill. Null means "no ingest boundary has written this",
-- which is deliberately distinct from an empty list ("ingested, nothing flagged").
ALTER TABLE "Response" ADD COLUMN     "ingest_flags" JSONB;
