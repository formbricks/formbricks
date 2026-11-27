-- ENG-7491: validate the foreign keys `20261123120000_add_contact_directories` added NOT VALID, now that the
-- backfill has filled `directoryId`. Every value was written from an existing workspace or directory, and
-- every `workspaceId` was already checked by the constraint each one replaces, so this finds nothing to
-- reject.
--
-- Each VALIDATE scans its table under SHARE UPDATE EXCLUSIVE, which lets reads and writes through, and
-- briefly takes ROW SHARE on the referenced table. No transaction around the file, so each one holds its
-- lock only for its own scan. VALIDATE on a constraint that is already valid is a no-op, so the file
-- reruns cleanly.
SET lock_timeout = '5s';

-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Workspace" VALIDATE CONSTRAINT "Workspace_contactDirectoryId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "ContactAttributeKey" VALIDATE CONSTRAINT "ContactAttributeKey_workspaceId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "ContactAttributeKey" VALIDATE CONSTRAINT "ContactAttributeKey_directoryId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Segment" VALIDATE CONSTRAINT "Segment_workspaceId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Segment" VALIDATE CONSTRAINT "Segment_directoryId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Contact" VALIDATE CONSTRAINT "Contact_workspaceId_fkey";
-- squawk-ignore prefer-robust-stmts
ALTER TABLE "Contact" VALIDATE CONSTRAINT "Contact_directoryId_fkey";

RESET lock_timeout;
