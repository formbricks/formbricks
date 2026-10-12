-- A survey's archive notice is void for good once a person moves its clock back (ENG-3612).
--
-- Under "no response" a survey's retention clock is its newest response, and its archive notice holds
-- only while the clock is the one the notice was computed for (`RetentionNotice.clockAt`). That check
-- holds no memory: a clock moved back onto a notice an earlier response had voided would make it count
-- again, and the survey would be archived with no new email. Two ways a person moves the clock back are
-- caught here, and each clears `clockAt` (NULL equals no clock), so the next sweep sends a new notice and
-- the full warning runs again:
-- - deleting responses (in the app, the API, or by cascade from a contact), with a statement-level
--   trigger over the deleted rows, so a bulk delete costs one UPDATE, not one per response;
-- - moving a response's `created_at` (the management API accepts one) or its survey, row by row.
--
-- The responses policy's own deletions are not a person's: its delete transaction sets
-- `formbricks.retention_policy_delete` to `on` (transaction-local) and re-stamps the notice itself, for
-- the clock it leaves (`restampSurveyNoticeAfterRetentionDeletion`). Nothing in the policy updates a
-- response, so the update trigger has no such exception.
--
-- Both lock the notices they clear in "surveyId" order, the order the sweep claims them in (its
-- candidates are read and claimed by survey id), so a delete spanning several surveys can't deadlock with
-- a claim. A survey deleted with its responses deletes its notices too (both cascade); the delete trigger
-- then finds none of them.
BEGIN;
-- Each CREATE TRIGGER takes a SHARE ROW EXCLUSIVE lock on "Response", which waits for the writes in
-- flight and holds new ones while it waits: give up after a second instead. The transaction then rolls
-- the whole file back and the deploy stops with the migration recorded as failed; once the database is
-- quieter, mark it rolled back (`prisma migrate resolve --rolled-back`) and deploy again. See "How Prisma
-- applies a migration file" in packages/database/README.md.
SET LOCAL lock_timeout = '1s';

CREATE OR REPLACE FUNCTION retention_notice_void_on_response_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('formbricks.retention_policy_delete', true) IS NOT DISTINCT FROM 'on' THEN
    RETURN NULL;
  END IF;
  -- Most deletes find no clock-bound notice at all: skip reading the deleted rows then. The table holds
  -- one row per survey or member with a notice in flight, so this is a short scan.
  IF NOT EXISTS (SELECT 1 FROM "RetentionNotice" WHERE "entity" = 'surveys' AND "clockAt" IS NOT NULL) THEN
    RETURN NULL;
  END IF;
  UPDATE "RetentionNotice"
  SET "clockAt" = NULL
  WHERE "id" IN (
    SELECT "id" FROM "RetentionNotice"
    WHERE "entity" = 'surveys'
      AND "clockAt" IS NOT NULL
      AND "surveyId" IN (SELECT "surveyId" FROM old_rows)
    ORDER BY "surveyId"
    FOR UPDATE
  );
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION retention_notice_void_on_response_move() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "RetentionNotice"
  SET "clockAt" = NULL
  WHERE "id" IN (
    SELECT "id" FROM "RetentionNotice"
    WHERE "entity" = 'surveys'
      AND "clockAt" IS NOT NULL
      AND "surveyId" IN (OLD."surveyId", NEW."surveyId")
    ORDER BY "surveyId"
    FOR UPDATE
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS retention_notice_void_on_response_delete ON "Response";
CREATE TRIGGER retention_notice_void_on_response_delete
  AFTER DELETE ON "Response"
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION retention_notice_void_on_response_delete();

DROP TRIGGER IF EXISTS retention_notice_void_on_response_move ON "Response";
CREATE TRIGGER retention_notice_void_on_response_move
  AFTER UPDATE OF "created_at", "surveyId" ON "Response"
  FOR EACH ROW
  WHEN (OLD."created_at" IS DISTINCT FROM NEW."created_at" OR OLD."surveyId" IS DISTINCT FROM NEW."surveyId")
  EXECUTE FUNCTION retention_notice_void_on_response_move();

COMMIT;
