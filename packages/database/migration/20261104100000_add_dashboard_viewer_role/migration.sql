-- AlterEnum
-- Additive only: no existing membership changes role. `IF NOT EXISTS` keeps a re-run (or a database
-- created with `db:push`) a no-op instead of an error. The new role projects to its own SpiceDB
-- organization relation (ADR-0023); that schema change ships in `authzed/schema.zed`, not here.
--
-- Wrapped so `lock_timeout` can be SET LOCAL and expire with the transaction. ADD VALUE is
-- metadata-only but takes a lock on the type, and queueing for it behind a long query is what turns
-- a fast migration into an outage. ADD VALUE may run inside a transaction on PostgreSQL 12+.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TYPE "OrganizationRole" ADD VALUE IF NOT EXISTS 'dashboard_viewer' AFTER 'billing';

COMMIT;
