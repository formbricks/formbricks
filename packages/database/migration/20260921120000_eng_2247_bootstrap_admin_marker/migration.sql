-- ENG-2247: serialize the fresh-instance sign-up exception.
--
-- A closed instance admits exactly one uninvited account — the initial administrator, who has no
-- invite to present. That was gated on `SELECT count(*) FROM "User"`, read well before the row it
-- gates ever commits, so two concurrent sign-ups both saw zero and both were admitted. The unique
-- index below decides between them instead: both stamp the marker, only one INSERT can carry it.
-- NULLs are distinct in Postgres, so every other account is unaffected.
--
-- The enum has one value on purpose. Over a nullable boolean this index would hold a slot for `true`
-- AND one for `false`, so the first `false` ever written would take the second slot and break every
-- later sign-up. There is no `false` to write here.

SET lock_timeout = '1s';

-- CreateEnum
-- Guarded rather than bare: this migration must be idempotent and convergent, including against a
-- database created with `db:push`, where the type and column already exist.
DO $$
BEGIN
  CREATE TYPE "BootstrapAdminMarker" AS ENUM ('bootstrapAdmin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBootstrapAdmin" "BootstrapAdminMarker";

-- CreateIndex
-- Not CONCURRENTLY. "User" is ~55k rows in production, where this build measures ~45ms; an
-- interrupted concurrent build instead leaves an INVALID index, which enforces nothing while looking
-- present. For the index that IS this fix, 45ms of write lock is the better failure mode.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "User_isBootstrapAdmin_key" ON "User"("isBootstrapAdmin");

RESET lock_timeout;
