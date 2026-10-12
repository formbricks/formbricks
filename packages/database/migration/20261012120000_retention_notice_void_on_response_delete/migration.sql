-- A survey's archive notice is void once a person deletes any of its responses (ENG-3612).
--
-- Under "no response" a survey's retention clock is its newest response, and its archive notice holds
-- only while the clock is the one the notice was computed for (`RetentionNotice.clockAt`). A deletion
-- moves the clock back, possibly onto a notice an earlier response had voided, which would then count
-- again: the survey archived with no new email. Clearing `clockAt` makes the notice void for good (NULL
-- equals no clock), so the next sweep sends a new one and the full warning runs again.
--
-- The responses policy's own deletions are not a person's: its delete transaction sets
-- `formbricks.retention_policy_delete` to `on` (transaction-local) and re-stamps the notice itself, for
-- the clock it leaves (`restampSurveyNoticeAfterRetentionDeletion`).
--
-- One statement-level trigger over the deleted rows, so a bulk delete costs one UPDATE, not one per
-- response. A survey deleted with its responses deletes its notices too (both cascade); the UPDATE then
-- finds none of them.
BEGIN;
-- CREATE TRIGGER takes a SHARE ROW EXCLUSIVE lock on "Response", which waits for the writes in flight
-- and holds new ones while it waits: fail fast instead and let the deploy be retried.
SET LOCAL lock_timeout = '1s';

CREATE OR REPLACE FUNCTION retention_notice_void_on_response_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('formbricks.retention_policy_delete', true) IS DISTINCT FROM 'on' THEN
    UPDATE "RetentionNotice"
    SET "clockAt" = NULL
    WHERE "entity" = 'surveys'
      AND "clockAt" IS NOT NULL
      AND "surveyId" IN (SELECT DISTINCT "surveyId" FROM old_rows);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER retention_notice_void_on_response_delete
  AFTER DELETE ON "Response"
  REFERENCING OLD TABLE AS old_rows
  FOR EACH STATEMENT EXECUTE FUNCTION retention_notice_void_on_response_delete();

COMMIT;
