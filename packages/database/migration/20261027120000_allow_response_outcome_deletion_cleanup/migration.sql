-- Let `DeletionCleanup_kind_check` accept the `hubResponseOutcome` kind (ENG-6785): exactly one response
-- id and no files. Without this every insert of the new kind fails the CHECK.
--
-- The new constraint is added NOT VALID, which still checks every new write, and validated against the
-- existing rows by the next migration, apart from this one, so the check does not hold this transaction's
-- lock. Drop and add share one transaction: there is no moment without the guard. The old shapes are copied
-- unchanged from 20261008120000_add_deletion_cleanup.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE "DeletionCleanup" DROP CONSTRAINT IF EXISTS "DeletionCleanup_kind_check";

ALTER TABLE "DeletionCleanup" ADD CONSTRAINT "DeletionCleanup_kind_check" CHECK (
    ("kind" = 'hubSurvey' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
    OR ("kind" = 'hubResponses' AND COALESCE(cardinality("responseIds"), 0) > 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
    OR ("kind" = 'hubResponseOutcome' AND COALESCE(cardinality("responseIds"), 0) = 1 AND COALESCE(cardinality("fileKeys"), 0) = 0)
    OR ("kind" = 'storageFiles' AND COALESCE(cardinality("fileKeys"), 0) > 0 AND COALESCE(cardinality("responseIds"), 0) = 0)
    OR ("kind" = 'storageSurveyFolder' AND COALESCE(cardinality("responseIds"), 0) = 0 AND COALESCE(cardinality("fileKeys"), 0) = 0)
) NOT VALID;

COMMIT;
