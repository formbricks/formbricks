-- ENG-2247: serialize the fresh-instance sign-up exception.
--
-- A closed instance admits exactly one uninvited account — the initial administrator, who has no
-- invite to present. That exception was a plain `SELECT count(*) FROM "User"`, read well before the
-- row it gates ever commits, so two concurrent sign-ups both saw zero and both were admitted.
--
-- There is no transaction to put the check and the insert into: the credential sign-up route is wrapped
-- in `runWithTransaction`, but our Prisma adapter is configured without `transaction: true`, and turning
-- it on would put Argon2 hashing and an awaited verification email inside a Prisma interactive
-- transaction on every sign-up. So the marker rides the INSERT itself — only one row can carry it, and
-- the loser fails on this index instead of on a race.
--
-- One transaction for the whole file. Prisma 7.8 does not add one, and a partial apply is the one
-- outcome that must not happen here: the column without its index is a marker the application writes
-- and nothing enforces, which reads as working code while the control is silently absent.

BEGIN;
-- Bounds the WAIT for the lock, not the work. Both statements below take ACCESS EXCLUSIVE on "User";
-- failing fast beats queueing every sign-in behind us while we wait.
SET LOCAL lock_timeout = '5s';

-- AlterTable
-- Nullable with no default, so this is a catalog-only change on PG 11+ — no table rewrite.
ALTER TABLE "User" ADD COLUMN "isBootstrapAdmin" BOOLEAN;

-- AddCheckConstraint
-- "Not the bootstrap admin" is NULL, never `false`. A unique index on a nullable boolean holds one
-- slot for `true` AND one for `false`, so the first `false` ever written takes the second slot and
-- every later sign-up fails on the unique index with an opaque error. This makes `false` unwritable,
-- which turns a silent instance-wide outage into a rejected write at the line that causes it.
--
-- NOT VALID defers the validating scan out of the lock, but this file holds ACCESS EXCLUSIVE for the
-- index build below regardless, so deferring buys nothing and would leave the constraint unvalidated
-- until a follow-up. The column was added by the statement above, so every row is NULL and passes.
-- squawk-ignore constraint-missing-not-valid
ALTER TABLE "User" ADD CONSTRAINT "User_isBootstrapAdmin_true_or_null" CHECK ("isBootstrapAdmin" IS NULL OR "isBootstrapAdmin");

-- CreateIndex
-- Deliberately NOT concurrent, for two reasons. Postgres rejects CONCURRENTLY inside a transaction
-- block, and the transaction is what stops the column and its constraint from being applied apart.
-- More importantly, an interrupted concurrent build leaves an INVALID index behind — and an invalid
-- unique index does not enforce uniqueness. For an index that IS the security control, a build that
-- either completes or fails is worth more than one that cannot block writes: the failure mode here is
-- not a slow deploy, it is a constraint everyone believes exists.
--
-- The cost is one scan of "User" under lock. That is a table orders of magnitude smaller than
-- "Response", over a column this transaction just created, so every row is NULL.
-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX "User_isBootstrapAdmin_key" ON "User"("isBootstrapAdmin");

COMMIT;
