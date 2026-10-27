-- Check the rows that already exist against the CHECK the previous migration added NOT VALID (ENG-6785).
-- Takes only a lock that lets reads and writes through; the old kinds keep the shapes they always had, so
-- this finds nothing to reject.
BEGIN;
SET LOCAL lock_timeout = '1s';

ALTER TABLE "DeletionCleanup" VALIDATE CONSTRAINT "DeletionCleanup_kind_check";

COMMIT;
