-- Dashboard filters (ADR-0026): the filters a dashboard's editors pin to its top bar, saved on the dashboard
-- as an ordered JSON list. A column with a constant default is added without rewriting the table, and every
-- existing dashboard starts with no filters.

SET lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "filters" JSONB NOT NULL DEFAULT '[]';
