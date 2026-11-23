-- ENG-7491: contact directories, schema step. Contacts, attribute keys and segments move from the workspace
-- to an organization-level contact directory. This file only adds the shape; the data migrations after it
-- give every workspace a directory and fill `directoryId`, and the online index list builds the new
-- indexes concurrently once they finish.
--
-- Changes to existing tables are metadata-only: nullable columns with no default, `workspaceId` made
-- nullable, and each `workspaceId` foreign key re-added as SET NULL (it means "the workspace the row was
-- created from" from now on). Dropping NOT NULL breaks no client: the previous release always writes
-- `workspaceId`, and this release reads the NULL only for rows of a deleted workspace in a shared directory. Foreign keys are added NOT VALID, so nothing scans a table while this file
-- holds its locks; `20261123120003_validate_contact_directory_foreign_keys` validates them later under a
-- lock that lets reads and writes through.
--
-- The previous release keeps writing during a rolling deploy and knows nothing of directories:
--  - `contact_directory_from_workspace` fills a missing `directoryId` from the row's workspace on every
--    insert into Contact, ContactAttributeKey and Segment. Drop it one release later.
--  - Deleting a workspace no longer cascades to these tables. `contact_directory_delete_unused` deletes the
--    workspace's directory when no other workspace uses it, which takes its contacts, keys and segments
--    with it, as the cascade did. `contact_directory_delete_workspace_rows` deletes the workspace's rows
--    that have no directory yet (not backfilled, or a workspace made without one), which would otherwise
--    be left with neither a workspace nor a directory.
--
-- One transaction, so the swap of each foreign key is atomic and a failed run leaves nothing behind. The
-- tables are taken in an order that holds the lock on "Workspace", which every request reads, shortest.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  CREATE TYPE "ContactDirectoryMatchingKey" AS ENUM ('email', 'externalId');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ContactDirectory" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT,
    "matchingKey" "ContactDirectoryMatchingKey" NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "ContactDirectory_pkey" PRIMARY KEY ("id")
);

-- The table is new and empty, so a plain index build blocks nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "ContactDirectory_organizationId_name_key" ON "ContactDirectory"("organizationId", "name");

-- The table is new and empty: there is nothing to validate.
DO $$
BEGIN
  ALTER TABLE "ContactDirectory" ADD CONSTRAINT "ContactDirectory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Fills a missing directory from the row's workspace. A workspace with no directory yet leaves it NULL,
-- and the contact backfill picks the row up.
CREATE OR REPLACE FUNCTION contact_directory_from_workspace() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."directoryId" IS NULL AND NEW."workspaceId" IS NOT NULL THEN
    SELECT w."contactDirectoryId" INTO NEW."directoryId" FROM "Workspace" w WHERE w."id" = NEW."workspaceId";
  END IF;
  RETURN NEW;
END;
$$;

-- Contact
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "directoryId" TEXT;
-- squawk-ignore ban-drop-not-null
ALTER TABLE "Contact" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_workspaceId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_directoryId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "ContactDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
DROP TRIGGER IF EXISTS contact_directory_from_workspace ON "Contact";
CREATE TRIGGER contact_directory_from_workspace BEFORE INSERT ON "Contact"
  FOR EACH ROW EXECUTE FUNCTION contact_directory_from_workspace();

-- ContactAttributeKey
ALTER TABLE "ContactAttributeKey" ADD COLUMN IF NOT EXISTS "directoryId" TEXT;
-- squawk-ignore ban-drop-not-null
ALTER TABLE "ContactAttributeKey" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "ContactAttributeKey" DROP CONSTRAINT IF EXISTS "ContactAttributeKey_workspaceId_fkey";
ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "ContactAttributeKey" DROP CONSTRAINT IF EXISTS "ContactAttributeKey_directoryId_fkey";
ALTER TABLE "ContactAttributeKey" ADD CONSTRAINT "ContactAttributeKey_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "ContactDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
DROP TRIGGER IF EXISTS contact_directory_from_workspace ON "ContactAttributeKey";
CREATE TRIGGER contact_directory_from_workspace BEFORE INSERT ON "ContactAttributeKey"
  FOR EACH ROW EXECUTE FUNCTION contact_directory_from_workspace();

-- Segment
ALTER TABLE "Segment" ADD COLUMN IF NOT EXISTS "directoryId" TEXT;
-- squawk-ignore ban-drop-not-null
ALTER TABLE "Segment" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "Segment" DROP CONSTRAINT IF EXISTS "Segment_workspaceId_fkey";
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "Segment" DROP CONSTRAINT IF EXISTS "Segment_directoryId_fkey";
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_directoryId_fkey" FOREIGN KEY ("directoryId") REFERENCES "ContactDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
DROP TRIGGER IF EXISTS contact_directory_from_workspace ON "Segment";
CREATE TRIGGER contact_directory_from_workspace BEFORE INSERT ON "Segment"
  FOR EACH ROW EXECUTE FUNCTION contact_directory_from_workspace();

-- Workspace
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "contactDirectoryId" TEXT;
ALTER TABLE "Workspace" DROP CONSTRAINT IF EXISTS "Workspace_contactDirectoryId_fkey";
ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_contactDirectoryId_fkey" FOREIGN KEY ("contactDirectoryId") REFERENCES "ContactDirectory"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

-- Before the row goes, so the rows are still found by "workspaceId" (SET NULL clears it afterwards).
CREATE OR REPLACE FUNCTION contact_directory_delete_workspace_rows() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM "Contact" WHERE "workspaceId" = OLD."id" AND "directoryId" IS NULL;
  DELETE FROM "ContactAttributeKey" WHERE "workspaceId" = OLD."id" AND "directoryId" IS NULL;
  DELETE FROM "Segment" WHERE "workspaceId" = OLD."id" AND "directoryId" IS NULL;
  RETURN OLD;
END;
$$;

-- After the row goes, so the check no longer sees it. The directory row is locked first: when two
-- workspaces of one directory are deleted at once, the second waits for the first to commit, then sees it
-- gone and deletes the directory, instead of each seeing the other and leaving it behind.
CREATE OR REPLACE FUNCTION contact_directory_delete_unused() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."contactDirectoryId" IS NOT NULL THEN
    PERFORM 1 FROM "ContactDirectory" WHERE "id" = OLD."contactDirectoryId" FOR UPDATE;
    DELETE FROM "ContactDirectory" d
    WHERE d."id" = OLD."contactDirectoryId"
      AND NOT EXISTS (SELECT 1 FROM "Workspace" w WHERE w."contactDirectoryId" = d."id");
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS contact_directory_delete_workspace_rows ON "Workspace";
CREATE TRIGGER contact_directory_delete_workspace_rows BEFORE DELETE ON "Workspace"
  FOR EACH ROW EXECUTE FUNCTION contact_directory_delete_workspace_rows();
DROP TRIGGER IF EXISTS contact_directory_delete_unused ON "Workspace";
CREATE TRIGGER contact_directory_delete_unused AFTER DELETE ON "Workspace"
  FOR EACH ROW EXECUTE FUNCTION contact_directory_delete_unused();

COMMIT;
