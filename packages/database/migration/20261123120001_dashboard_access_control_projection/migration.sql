-- ENG-7470 / ENG-7471 (ADR-0059): project dashboards, their pages and team dashboard limits into SpiceDB
-- through the existing outbox, and queue every existing dashboard, page and limited team so the normal
-- outbox delivery copies them into SpiceDB.
--
-- This file must sort AFTER 20261123120000_dashboard_access_control, which creates the tables and an
-- "Overview" page per dashboard: the rows queued at the end include those pages.
--
-- This release upgrades in a maintenance window, with no rolling-upgrade fallback: stop writers, run
-- the migrations, run `formbricks-authzed upgrade prepare`, restart. The order matters: `upgrade prepare`
-- applies the schema that defines `dashboard_page` and then drains the outbox, so this migration has to
-- have queued its rows first. Nothing of the previous release may deliver the outbox meanwhile; it would
-- skip the two new target types (ENG-7153), which only project relationships it never reads.
--
-- Events, and the reconciler each lands in:
--
--   Dashboard insert, delete, workspaceId change      -> `dashboard` (id)            ./dashboard.ts
--   DashboardPage insert, delete, dashboardId change  -> `dashboard_page` (id)       ./dashboard.ts
--   DashboardPageTeam insert, delete                  -> `dashboard_page` (pageId)   ./dashboard.ts
--   TeamDashboard insert, delete                      -> `dashboard` (dashboardId)   ./dashboard.ts
--                                                    and `team` (teamId)           ./team-workspace.ts
--   WorkspaceTeam insert, delete (existing trigger)   -> `workspace_team`; the outbox processor also
--                                                       re-projects the dashboards that team selected
--                                                       in that workspace (`selected_by_team`)
--
-- Both functions are re-declared whole from 20261002120002_add_survey_projection_trigger. The only
-- changes are the INSERT and DELETE classification in `enqueue_authzed_projection`, which reads the
-- table an event comes from for the four new triggers; the grant classifier is unchanged, and the other
-- triggers behave exactly as before. Paths in the comments are under apps/web/lib/authzed/.
--
-- Grant or revocation, per event (a revocation arms the freshness guard until it is delivered, so the
-- unsafe mistake is calling a narrowing a grant; calling a widening a revocation only costs latency):
--
--   * Dashboard / DashboardPage INSERT: grant. New edges only.
--   * Dashboard / DashboardPage DELETE: not a revocation, like a survey: every dashboard and page
--     decision resolves the row in PostgreSQL first and denies once it is gone, so leftover edges grant
--     nothing and removing them is hygiene. Counting them would let deleting a workspace with many
--     dashboards arm the freshness guard for every tenant.
--   * Dashboard workspaceId / DashboardPage dashboardId change: revocation (the classifier's ELSE false):
--     the old parent's readers lose it.
--   * DashboardPageTeam INSERT: revocation, always. Adding a page's first limit removes its `open_on`
--     edge, so everyone outside the team loses the page. Adding a further team only widens it, but an
--     AFTER ROW trigger sees the whole statement's rows, so "is this the first limit?" can't be answered
--     for a multi-row insert; it is classified as the narrowing it may be.
--   * DashboardPageTeam DELETE: revocation while the page keeps another limit (that team's viewers lose
--     the page), a grant once no limit is left (the page opens to every reader of its dashboard). Checked
--     at statement end, so a later statement re-adding a limit queues its own revocation, and a page
--     deleted with its limits queues none.
--   * TeamDashboard INSERT -> `dashboard`: grant (a `selected_by_team` edge). -> `team`: revocation,
--     always: the team's first selection writes the `dashboard_limited` marker and narrows its viewers
--     from every dashboard to the selected ones (a multi-row insert can't tell which row is first).
--   * TeamDashboard DELETE -> `dashboard`: revocation while the dashboard exists (the team's viewers lose
--     it), not one once the dashboard is gone (deleted with it, see above). -> `team`: grant: the marker
--     goes only with the last selection, and that widens the team's viewers to every dashboard.
--
-- The app must already know the `dashboard` and `dashboard_page` outbox target types when this runs
-- (outbox-types.ts ships in the same release).

SET lock_timeout = '1s';

CREATE OR REPLACE FUNCTION authzed_projection_is_grant(
  target_type text,
  previous_source jsonb,
  source jsonb
) RETURNS boolean AS $$
  SELECT CASE target_type
    -- reconcileUser deletes every relationship while `isActive` is false, so false -> true can only
    -- add them back. `isActive` is the only column the User trigger watches.
    WHEN 'user' THEN
      (previous_source ->> 'isActive') IS DISTINCT FROM 'true'
      AND (source ->> 'isActive') = 'true'

    -- feedback-directory.ts writes assignment edges as `delete` while the directory is archived and
    -- `touch` once it is not. Its parent edge is only ever touched, never re-pointed, so an
    -- organizationId move leaves the old organization's administrators in place: still a revocation.
    WHEN 'feedback_directory' THEN
      (previous_source ->> 'isArchived') = 'true'
      AND (source ->> 'isArchived') IS DISTINCT FROM 'true'
      AND previous_source ->> 'organizationId' IS NOT DISTINCT FROM source ->> 'organizationId'

    -- organization-membership.ts projects every membership row regardless of `accepted` (see the
    -- comment on its readSnapshot), so accepting an invite writes byte-identical relationships.
    -- A `role` move always deletes the relation for the old role, so it stays a revocation.
    WHEN 'membership' THEN
      previous_source ->> 'role' IS NOT DISTINCT FROM source ->> 'role'

    -- survey.ts reconciles the survey's edges to exactly what its row implies. Only restricted -> workspace
    -- on the same owner and workspace provably adds edges without removing any; a write that leaves all
    -- three facts as they were projects byte-identical relationships. Every other move takes access
    -- away from someone: an owner change drops the old owner, a workspace move drops the old workspace,
    -- and workspace -> restricted drops the shared edge.
    --
    -- Except an owner cleared to NULL. Nothing in the app writes that: it is `ON DELETE SET NULL` when the
    -- owning user is deleted, once per survey they owned. Both owner arms of the schema intersect
    -- `workspace->read` (`private_owner & workspace->…`, `owner & workspace->read`), and that user's own
    -- revocation removes their workspace read, so the dropped owner edge takes nothing the user deletion
    -- has not already taken. Counting it would queue one revocation per owned survey and let deleting a
    -- prolific owner arm the freshness guard for every tenant.
    WHEN 'survey' THEN
      (previous_source ->> 'workspaceId') IS NOT DISTINCT FROM (source ->> 'workspaceId')
      AND (
        (previous_source ->> 'ownerId') IS NOT DISTINCT FROM (source ->> 'ownerId')
        OR (source ->> 'ownerId') IS NULL
      )
      AND (
        (previous_source ->> 'visibility') IS NOT DISTINCT FROM (source ->> 'visibility')
        OR (
          (previous_source ->> 'visibility') = 'restricted'
          AND (source ->> 'visibility') = 'workspace'
        )
      )

    -- `dashboard` and `dashboard_page` updates (a parent move, or a limit row re-keyed) fall through to
    -- ELSE false on purpose: each takes the old parent's or team's access away.
    ELSE false
  END;
$$ LANGUAGE sql IMMUTABLE;

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
    -- ADR-0059: a page's team limit, and a team's first dashboard selection (the `team` event of
    -- TeamDashboard), narrow who reads; see the classification table at the top of this file.
    WHEN TG_OP = 'INSERT' THEN
      TG_TABLE_NAME = 'DashboardPageTeam'
      OR (TG_TABLE_NAME = 'TeamDashboard' AND target_type = 'team')
    -- A deleted survey, dashboard or page is not a revocation: every decision about one resolves its
    -- row first and denies once it is gone, so leftover edges grant nothing and are hygiene for the
    -- projector. Counting it would let deleting a workspace with many of them arm the freshness guard.
    WHEN TG_OP = 'DELETE' THEN CASE
      WHEN TG_TABLE_NAME IN ('Survey', 'Dashboard', 'DashboardPage') THEN false
      -- Removing a page limit narrows only while another limit stays on the page.
      WHEN TG_TABLE_NAME = 'DashboardPageTeam' THEN
        EXISTS (SELECT 1 FROM "DashboardPageTeam" WHERE "pageId" = source ->> 'pageId')
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

-- A parent move is the only update that changes a dashboard's or page's edges. Two triggers each,
-- because a DELETE trigger's WHEN can't name NEW.
DROP TRIGGER IF EXISTS "authzed_projection_dashboard" ON "Dashboard";
CREATE TRIGGER "authzed_projection_dashboard"
AFTER INSERT OR DELETE ON "Dashboard"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('dashboard', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_dashboard_workspace" ON "Dashboard";
CREATE TRIGGER "authzed_projection_dashboard_workspace"
AFTER UPDATE OF "workspaceId" ON "Dashboard"
FOR EACH ROW WHEN (OLD."workspaceId" IS DISTINCT FROM NEW."workspaceId")
EXECUTE FUNCTION enqueue_authzed_projection('dashboard', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_dashboard_page" ON "DashboardPage";
CREATE TRIGGER "authzed_projection_dashboard_page"
AFTER INSERT OR DELETE ON "DashboardPage"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('dashboard_page', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_dashboard_page_dashboard" ON "DashboardPage";
CREATE TRIGGER "authzed_projection_dashboard_page_dashboard"
AFTER UPDATE OF "dashboardId" ON "DashboardPage"
FOR EACH ROW WHEN (OLD."dashboardId" IS DISTINCT FROM NEW."dashboardId")
EXECUTE FUNCTION enqueue_authzed_projection('dashboard_page', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_dashboard_page_team" ON "DashboardPageTeam";
CREATE TRIGGER "authzed_projection_dashboard_page_team"
AFTER INSERT OR DELETE OR UPDATE OF "pageId", "teamId" ON "DashboardPageTeam"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('dashboard_page', 'pageId', '');

-- One TeamDashboard row moves two resources: the dashboard's `selected_by_team` edge and the team's
-- `dashboard_limited` marker, which the team reconciler owns.
DROP TRIGGER IF EXISTS "authzed_projection_team_dashboard" ON "TeamDashboard";
CREATE TRIGGER "authzed_projection_team_dashboard"
AFTER INSERT OR DELETE OR UPDATE OF "teamId", "dashboardId" ON "TeamDashboard"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('dashboard', 'dashboardId', '');

DROP TRIGGER IF EXISTS "authzed_projection_team_dashboard_team" ON "TeamDashboard";
CREATE TRIGGER "authzed_projection_team_dashboard_team"
AFTER INSERT OR DELETE OR UPDATE OF "teamId", "dashboardId" ON "TeamDashboard"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('team', 'teamId', '');

-- ENG-7471: queue the initial projection of every existing dashboard and page (pages include the
-- "Overview" page the previous migration created per dashboard). Grants: until delivered, a dashboard
-- or page has no edges and a Dashboard Viewer reads neither, which fails closed. A limited team (none
-- exist before this release) is queued as a revocation, since its missing marker would leave its
-- viewers reaching every dashboard. In the same transaction as the triggers, so a row written while
-- this runs is either queued here or by its trigger.
INSERT INTO "AuthzedProjectionOutbox" ("id", "targetType", "primaryId", "isRevocation", "updatedAt")
SELECT gen_random_uuid()::text, 'dashboard', "id", false, NOW() FROM "Dashboard";

INSERT INTO "AuthzedProjectionOutbox" ("id", "targetType", "primaryId", "isRevocation", "updatedAt")
SELECT gen_random_uuid()::text, 'dashboard_page', "id", false, NOW() FROM "DashboardPage";

INSERT INTO "AuthzedProjectionOutbox" ("id", "targetType", "primaryId", "isRevocation", "updatedAt")
SELECT gen_random_uuid()::text, 'team', "teamId", true, NOW()
FROM (SELECT DISTINCT "teamId" FROM "TeamDashboard") AS limited_teams;


-- The team marker follows `Team.dashboardLimited`, which the limits write sets in the same transaction
-- as its `TeamDashboard` rows. A flag change with no row change (clearing a limit whose dashboards were
-- all deleted) still has to reach SpiceDB, so the column gets its own trigger. Any update is classified
-- as a revocation, which is the safe side for both directions.
DROP TRIGGER IF EXISTS "authzed_projection_team_dashboard_limited" ON "Team";
CREATE TRIGGER "authzed_projection_team_dashboard_limited"
AFTER UPDATE OF "dashboardLimited" ON "Team"
FOR EACH ROW WHEN (OLD."dashboardLimited" IS DISTINCT FROM NEW."dashboardLimited")
EXECUTE FUNCTION enqueue_authzed_projection('team', 'id', '');

RESET lock_timeout;
