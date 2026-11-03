-- AlterTable
-- The not-shown record (ENG-6936, ADR 0023). Additive only: a nullable JSON column with no default, so
-- every response that already exists keeps its shape and there is nothing to backfill. Null means
-- "unknown" (responses from before 6.2, or from an older cached survey bundle), and results read those
-- as before. Previous-release pods never select it, so a rolling upgrade is safe.
--
-- `IF NOT EXISTS` lets the file rerun on a database built with `db:push`. Wrapped so `lock_timeout` is
-- SET LOCAL: the column add is metadata-only, but "Response" is the busiest table in the schema and the
-- ACCESS EXCLUSIVE lock it takes for that moment is the part worth bounding.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "not_shown" JSONB;

COMMIT;
