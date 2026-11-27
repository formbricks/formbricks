-- The default widget layout follows the finer dashboard grid: 12 units tall, what 3 rows were.
-- A default change is metadata only (no table rewrite); the lock is held for an instant.
BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "DashboardWidget" ALTER COLUMN "layout" SET DEFAULT '{"x":0,"y":0,"w":4,"h":12}';
COMMIT;
