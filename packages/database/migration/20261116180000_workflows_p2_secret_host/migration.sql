-- Workflows Part 2, secret headers bound to their host (ENG-7179, ADR 0051). Additive only: a nullable
-- "boundOrigin" on "WorkflowSecret", the origin of the step's URL when the value was set or replaced.
-- Existing rows keep null ("set before host binding"): the origin they were entered for was never
-- recorded, so they are held to their step's saved URL until their value is set again. Previous-release
-- pods neither select nor write the column, so a rolling upgrade is safe. Guarded so the file reruns on
-- a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "WorkflowSecret" ADD COLUMN IF NOT EXISTS "boundOrigin" TEXT;

COMMIT;
