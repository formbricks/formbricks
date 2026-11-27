-- A Dashboard page limited to no team stays limited (P-ENG-110: an empty access selector means no
-- access). Until now a page was limited exactly while it had a `DashboardPageTeam` row, so deleting its
-- last limited team (which cascades to the row) reopened it to every reader of its dashboard.
-- `DashboardPage.teamLimited` now holds the limit, like `Team.dashboardLimited` holds a team's.
--
-- Three steps, each its own transaction:
--
--   1. Add the column. A constant default is metadata only, so the ACCESS EXCLUSIVE lock is held for an
--      instant.
--   2. Backfill: a page with at least one team limit is limited. Outside the lock of step 1. Nothing
--      changes in SpiceDB: such a page already has no `open_on` edge, and the trigger of step 3 does not
--      exist yet, so no outbox rows are queued.
--   3. Re-declare `enqueue_authzed_projection` whole from 20261123120001_dashboard_access_control_projection
--      with one change: removing a page limit is also a revocation while the page stays limited to no
--      team. Then watch the column: a page limited or unlimited without a limit row changing still has to
--      reach SpiceDB. Any update falls through the grant classifier's ELSE false to a revocation, the
--      safe side for both directions.
--
-- Rolling-upgrade safe: the previous release neither reads nor writes the column, and its default keeps
-- that release's page writes as they were (a page it limits has a limit row; the projector of this
-- release treats a page with a limit row as limited whatever the flag says).

BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE "DashboardPage" ADD COLUMN IF NOT EXISTS "teamLimited" BOOLEAN NOT NULL DEFAULT false;
COMMIT;

UPDATE "DashboardPage" p
SET "teamLimited" = true
WHERE NOT p."teamLimited"
  AND EXISTS (SELECT 1 FROM "DashboardPageTeam" t WHERE t."pageId" = p."id");

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION enqueue_authzed_projection()
RETURNS trigger AS $$
DECLARE
  source jsonb;
  previous_source jsonb;
  is_revocation boolean;
  target_type text := TG_ARGV[0];
  primary_field text := TG_ARGV[1];
  secondary_field text := NULLIF(TG_ARGV[2], '');
BEGIN
  source := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  -- A relationship source can move from one logical pair to another. Reconcile the old pair as a
  -- revocation before reconciling the current pair; otherwise the old edge is no longer discoverable
  -- from PostgreSQL and could survive with stale access.
  IF TG_OP = 'UPDATE' THEN
    previous_source := to_jsonb(OLD);
    IF previous_source ->> primary_field IS DISTINCT FROM source ->> primary_field
      OR (
        secondary_field IS NOT NULL
        AND previous_source ->> secondary_field IS DISTINCT FROM source ->> secondary_field
      )
    THEN
      INSERT INTO "AuthzedProjectionOutbox" (
        "id",
        "targetType",
        "primaryId",
        "secondaryId",
        "isRevocation",
        "updatedAt"
      ) VALUES (
        gen_random_uuid()::text,
        target_type,
        previous_source ->> primary_field,
        CASE WHEN secondary_field IS NULL THEN NULL ELSE previous_source ->> secondary_field END,
        true,
        NOW()
      );
    END IF;
  END IF;

  is_revocation := CASE
    -- ADR-0060: a page's team limit, and a team's first dashboard selection (the `team` event of
    -- TeamDashboard), narrow who reads; see the classification table at the top of this file.
    WHEN TG_OP = 'INSERT' THEN
      TG_TABLE_NAME = 'DashboardPageTeam'
      OR (TG_TABLE_NAME = 'TeamDashboard' AND target_type = 'team')
    -- A deleted survey, dashboard or page is not a revocation: every decision about one resolves its
    -- row first and denies once it is gone, so leftover edges grant nothing and are hygiene for the
    -- projector. Counting it would let deleting a workspace with many of them arm the freshness guard.
    WHEN TG_OP = 'DELETE' THEN CASE
      WHEN TG_TABLE_NAME IN ('Survey', 'Dashboard', 'DashboardPage') THEN false
      -- Removing a page limit narrows while the page stays limited: another limit stays on it, or it
      -- is limited to no team (`teamLimited`), so the removed team's viewers lose it and nobody gains it.
      WHEN TG_TABLE_NAME = 'DashboardPageTeam' THEN
        EXISTS (SELECT 1 FROM "DashboardPageTeam" WHERE "pageId" = source ->> 'pageId')
        OR EXISTS (SELECT 1 FROM "DashboardPage" WHERE id = source ->> 'pageId' AND "teamLimited")
      -- Removing a selection takes the dashboard from the team's viewers while the dashboard exists;
      -- removing the team's last selection only ever lifts its limit.
      WHEN TG_TABLE_NAME = 'TeamDashboard' THEN
        target_type = 'dashboard'
        AND EXISTS (SELECT 1 FROM "Dashboard" WHERE id = source ->> 'dashboardId')
      ELSE true
    END
    ELSE NOT authzed_projection_is_grant(target_type, previous_source, source)
  END;

  INSERT INTO "AuthzedProjectionOutbox" (
    "id",
    "targetType",
    "primaryId",
    "secondaryId",
    "isRevocation",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::text,
    target_type,
    source ->> primary_field,
    CASE WHEN secondary_field IS NULL THEN NULL ELSE source ->> secondary_field END,
    is_revocation,
    NOW()
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "authzed_projection_dashboard_page_team_limited" ON "DashboardPage";
CREATE TRIGGER "authzed_projection_dashboard_page_team_limited"
AFTER UPDATE OF "teamLimited" ON "DashboardPage"
FOR EACH ROW WHEN (OLD."teamLimited" IS DISTINCT FROM NEW."teamLimited")
EXECUTE FUNCTION enqueue_authzed_projection('dashboard_page', 'id', '');

COMMIT;
