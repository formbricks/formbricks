-- Drop dashboards and charts (agent-first experiment, ADR 0016): the "DashboardWidget", "Dashboard" and
-- "Chart" tables and the "ChartType" enum. With no human UI to draw them, a saved chart has no reader; agents
-- query Cube through `POST /api/v3/feedback-queries` and hold the query themselves.
--
-- DESTRUCTIVE: every stored chart, dashboard and widget row is deleted and cannot be recovered from this
-- database. Back up first if a self-hosted install wants to keep its saved queries.
--
-- Tables are dropped children first: "DashboardWidget" references both "Dashboard" and "Chart", so it goes
-- before either. Dropping a table also removes its own indexes and the foreign keys it holds ("Workspace",
-- "User" and "FeedbackDirectory" lose nothing: they only ever were the referenced side), so no separate
-- DropForeignKey / DropIndex statements are needed. "ChartType" is dropped last, once "Chart" no longer
-- uses it.
--
-- Every statement is IF EXISTS, so the file converges on a database built with `db:push` (where the tables
-- are already gone once the schema no longer names them) and is safe to run twice. One transaction makes it
-- all-or-nothing; `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into the
-- migrations that run after this one on the same connection. The brief ACCESS EXCLUSIVE lock each drop takes
-- is on the dropped table itself, plus a lock on the parents ("Workspace", "User", "FeedbackDirectory") to
-- remove the foreign keys, so failing fast beats queueing behind a long-running query.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- squawk-ignore ban-drop-table
DROP TABLE IF EXISTS "public"."DashboardWidget";

-- squawk-ignore ban-drop-table
DROP TABLE IF EXISTS "public"."Dashboard";

-- squawk-ignore ban-drop-table
DROP TABLE IF EXISTS "public"."Chart";

DROP TYPE IF EXISTS "public"."ChartType";

COMMIT;
