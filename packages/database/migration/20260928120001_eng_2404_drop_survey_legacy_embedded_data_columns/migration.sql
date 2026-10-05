-- AlterTable
-- ENG-2404: Embedded Data lives only in the `EmbeddedData` / `SurveyEmbeddedData` rows now. The
-- data migration just before this one gave every survey still without links the rows its columns
-- described, so nothing reads these two columns any more.
--
-- Wrapped so `lock_timeout` can be SET LOCAL and expire with the transaction rather than leaking
-- into the migrations that follow on the same connection. Dropping a column is metadata-only, but
-- it takes ACCESS EXCLUSIVE on "Survey" for that moment, and queueing for it behind a long read is
-- what turns a fast migration into an outage.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- Deliberate: the release that ships this neither selects nor writes either column, and the API
-- payloads that carry `variables` / `hiddenFields` derive them from the rows.
-- squawk-ignore ban-drop-column
ALTER TABLE "Survey" DROP COLUMN IF EXISTS "variables", DROP COLUMN IF EXISTS "hiddenFields";

COMMIT;
