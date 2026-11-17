-- AlterTable
-- A dashboard's default rolling date range: the preset name (e.g. "last 30 days") the dashboard opens
-- with when the URL names none. Additive only: a nullable TEXT column with no default, so every
-- existing dashboard keeps showing each chart's own range and there is nothing to backfill.
-- Previous-release pods never select it, so a rolling upgrade is safe.
--
-- `IF NOT EXISTS` lets the file rerun on a database built with `db:push`. Wrapped so `lock_timeout` is
-- SET LOCAL: the column add is metadata-only, but the ACCESS EXCLUSIVE lock it takes is worth bounding.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "defaultDateRange" TEXT;

COMMIT;
