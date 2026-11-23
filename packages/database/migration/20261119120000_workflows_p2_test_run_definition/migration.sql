-- Workflows Part 2, the definition a Test run executed (ADR 0049). Additive only: a nullable
-- "testRunDefinition" on "WorkflowRun", written when a Test run is saved so the Runs tab can draw the
-- graph it ran after the draft changes. Existing rows keep null: live runs point at their version, and
-- older Test runs never recorded their draft. Previous-release pods neither select nor write the column,
-- so a rolling upgrade is safe. Guarded so the file reruns on a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "testRunDefinition" JSONB;

COMMIT;
