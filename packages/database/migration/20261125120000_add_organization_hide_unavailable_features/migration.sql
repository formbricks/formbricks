-- An organization setting that hides workspace navigation items the plan or licence does not include.
-- Additive only: one new column with a constant default, so Postgres adds it without rewriting the table.
-- The previous release never reads or writes it, so a rolling upgrade is safe. `IF NOT EXISTS` lets the
-- file converge on a database built with `db:push`.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "hideUnavailableFeatures" BOOLEAN NOT NULL DEFAULT false;
