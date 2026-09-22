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
-- the loser fails on a unique index instead of on a race. That index is built by the migration that
-- follows this one, which needs to run outside a transaction.
--
-- Every statement here is re-runnable, and lands the same way on a database created by `db:push`:
-- that path already has the column (it is in `main.prisma`) but never the CHECK, which Prisma cannot
-- express, so the constraint is dropped and re-added rather than added blind.

BEGIN;
-- Bounds the WAIT for the lock, not the work. Both statements below take ACCESS EXCLUSIVE on "User";
-- failing fast beats queueing every sign-in behind us while we wait.
SET LOCAL lock_timeout = '1s';

-- AlterTable
-- Nullable with no default, so this is a catalog-only change on PG 11+ — no table rewrite.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isBootstrapAdmin" BOOLEAN;

-- AddCheckConstraint
-- "Not the bootstrap admin" is NULL, never `false`. A unique index on a nullable boolean holds one
-- slot for `true` AND one for `false`, so the first `false` ever written takes the second slot and
-- every later sign-up fails on the unique index with an opaque error. This makes `false` unwritable,
-- which turns a silent instance-wide outage into a rejected write at the line that causes it.
--
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, and a `DO` block would hide the statement from Squawk.
-- Dropping first is idempotent, and the gap is invisible: it closes before this transaction commits.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_isBootstrapAdmin_true_or_null";

-- NOT VALID defers the validating scan out of the ACCESS EXCLUSIVE lock, but the column was added by
-- the statement above, so every row is NULL and the scan cannot fail. Deferring would only leave the
-- constraint unvalidated until a follow-up that has no other reason to exist.
-- squawk-ignore constraint-missing-not-valid
ALTER TABLE "User" ADD CONSTRAINT "User_isBootstrapAdmin_true_or_null" CHECK ("isBootstrapAdmin" IS NULL OR "isBootstrapAdmin");

COMMIT;
