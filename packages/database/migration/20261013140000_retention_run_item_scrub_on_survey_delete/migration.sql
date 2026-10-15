-- A deleted survey's name leaves data retention History with it (ENG-3614: "deleted has to mean
-- deleted").
--
-- History rows (`RetentionRunItem`) keep a survey's name while the survey exists, so History and its CSV
-- can say which survey a row is about. Once the survey is deleted, its rows keep only its id, counts and
-- recipients. A trigger rather than the app's delete path, so every way a survey goes is covered: the
-- archive purge, a person's delete, and the cascades from a workspace or organisation delete (the latter
-- takes its History with it anyway).
--
-- Statement-level, over the deleted rows, so deleting a workspace's thousands of surveys costs one UPDATE.
-- It probes `RetentionRunItem(targetId)`, and only rows that still carry a name are written.
BEGIN;
-- CREATE TRIGGER takes a SHARE ROW EXCLUSIVE lock on "Survey", which waits for the writes in flight and
-- holds new ones while it waits: give up after a second instead. The transaction then rolls the whole
-- file back and the deploy stops with the migration recorded as failed; once the database is quieter,
-- mark it rolled back (`prisma migrate resolve --rolled-back`) and deploy again. See "How Prisma applies
-- a migration file" in packages/database/README.md.
SET LOCAL lock_timeout = '1s';

CREATE OR REPLACE FUNCTION retention_run_item_scrub_on_survey_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "RetentionRunItem"
  SET "targetName" = NULL
  WHERE "targetType" = 'survey'
    AND "targetId" IN (SELECT "id" FROM old_surveys)
    AND "targetName" IS NOT NULL;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS retention_run_item_scrub_on_survey_delete ON "Survey";
CREATE TRIGGER retention_run_item_scrub_on_survey_delete
  AFTER DELETE ON "Survey"
  REFERENCING OLD TABLE AS old_surveys
  FOR EACH STATEMENT EXECUTE FUNCTION retention_run_item_scrub_on_survey_delete();

COMMIT;
