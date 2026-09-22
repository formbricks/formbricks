-- ENG-2247: the unique index that makes the fresh-instance exception single-use.
--
-- This is the whole fix. `isBootstrapAdmin` is only a column until this exists: two concurrent
-- uninvited sign-ups both read zero users, both stamp the marker, and the index is what decides
-- between them. NULLs are distinct in Postgres, so every other account is unaffected.
--
-- Its own file because CONCURRENTLY cannot run inside a transaction, and Prisma only omits the
-- transaction wrapper for a file it recognises as concurrent — the migration before this one adds the
-- column and its CHECK, and mixing the two shapes would make this build fail.
--
-- Concurrent because "User" is a live table and a plain build holds a write lock for the length of the
-- scan, blocking every sign-in and sign-up. The cost of that choice is that an interrupted build leaves
-- an INVALID index, which enforces nothing while looking present — for a security control that is the
-- worst failure available, so the migration after this one refuses to let it pass silently.

-- Bounds only the WAIT for the lock, not the work. A concurrent build needs SHARE UPDATE EXCLUSIVE,
-- which conflicts with other schema changes; without a timeout an unlucky overlap queues behind it.
SET lock_timeout = '1s';

-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "User_isBootstrapAdmin_key" ON "User"("isBootstrapAdmin");

-- Do not leak the timeout into whatever migration shares this connection next.
RESET lock_timeout;
