-- Dashboard filters (ADR-0026): the filters a dashboard's editors lock for everyone, with their values, saved on the dashboard
-- as an ordered JSON list. A column with a constant default is added without rewriting the table, and every
-- existing dashboard starts with no filters.

-- Wrapped so `lock_timeout` is SET LOCAL and ends with the transaction instead of leaking into later
-- migrations on the same connection.
BEGIN;
SET LOCAL lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "filters" JSONB NOT NULL DEFAULT '[]';

COMMIT;
