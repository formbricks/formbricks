-- Workspace names for imported (embedded-data) keys in charts. Additive only: one new, empty table. No
-- existing column changes and no data moves. The previous release never reads or writes it, so a
-- rolling upgrade is safe.
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. The table, index and foreign key are created guarded, and the
-- foreign key is added apart from the table, so the file also converges on a database built with
-- `db:push`.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction. The foreign key locks "Workspace", a
-- live table; failing fast beats queueing behind a long-running query.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateTable
CREATE TABLE IF NOT EXISTS "EmbeddedFieldLabel" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "EmbeddedFieldLabel_pkey" PRIMARY KEY ("id")
);

-- The table is new and empty, so a plain index build blocks nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "EmbeddedFieldLabel_workspaceId_key_key" ON "EmbeddedFieldLabel"("workspaceId", "key");

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "EmbeddedFieldLabel" ADD CONSTRAINT "EmbeddedFieldLabel_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
