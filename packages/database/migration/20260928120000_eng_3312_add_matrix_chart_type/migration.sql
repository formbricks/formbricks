-- AlterEnum
-- Additive only: existing charts keep their type, and `IF NOT EXISTS` keeps a re-run (or a database
-- created with `db:push`) a no-op instead of an error. Placed after `big_number` explicitly so the
-- enum's order matches the schema's.
--
-- Wrapped so `lock_timeout` can be SET LOCAL and expire with the transaction. ADD VALUE is
-- metadata-only but takes a lock on the type, and queueing for it behind a long query is what turns
-- a fast migration into an outage. ADD VALUE may run inside a transaction on PostgreSQL 12+.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TYPE "ChartType" ADD VALUE IF NOT EXISTS 'matrix' AFTER 'big_number';

COMMIT;
