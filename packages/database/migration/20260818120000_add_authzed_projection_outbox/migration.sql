-- ENG-2408: authorization source changes and their projection intent must commit atomically.
-- PostgreSQL is the durable queue; BullMQ only wakes a worker that claims rows from this table.

CREATE TABLE IF NOT EXISTS "AuthzedProjectionOutbox" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "primaryId" TEXT NOT NULL,
    "secondaryId" TEXT,
    "isRevocation" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "permanentFailures" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leasedAt" TIMESTAMP(3),
    "leaseExpiresAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "processedAt" TIMESTAMP(3),
    "deadLetteredAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AuthzedProjectionOutbox_pkey" PRIMARY KEY ("id")
);

-- `attempts` drives the retry backoff and tells an operator how many times delivery was tried.
-- `permanentFailures` is the separate, much smaller budget that gates dead-lettering, so that a
-- SpiceDB outage of any duration can never dead-letter healthy events. See outbox-repository.ts.
ALTER TABLE "AuthzedProjectionOutbox"
  ADD COLUMN IF NOT EXISTS "permanentFailures" INTEGER NOT NULL DEFAULT 0;

-- One index per access pattern, each partial to the rows that pattern can ever match. Processed rows
-- are retained for seven days, so only the prune index below is allowed to carry that history —
-- otherwise every hot-path lookup pays for a week of delivered events.
--
-- These predicates cannot be expressed in Prisma (`@@index` has no `where`), so the model in
-- packages/database/schema/main.prisma deliberately declares no indexes and points here instead.
-- `prisma db push` on a dev database therefore drops them; rerunning this migration restores them,
-- which is the same contract the triggers below already live under.
DROP INDEX IF EXISTS "AuthzedProjectionOutbox_pending_idx";
DROP INDEX IF EXISTS "AuthzedProjectionOutbox_revocation_idx";
DROP INDEX IF EXISTS "AuthzedProjectionOutbox_leaseExpiresAt_idx";
DROP INDEX IF EXISTS "AuthzedProjectionOutbox_target_idx";

-- The claim. Its key columns ARE the claim's ORDER BY, so the LIMIT is served by an ordered index
-- scan with no sort. Also serves the freshness guard's overdue-revocation EXISTS (equality on the
-- leading key, range on the second) and every pending counter in the status query.
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_claim_idx"
  ON "AuthzedProjectionOutbox"("isRevocation" DESC, "createdAt" ASC)
  WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NULL;

-- Dead letters: the freshness guard's second EXISTS, the dead-letter gauge, and `outbox replay`.
-- A dead-lettered row always has a NULL `processedAt` — the claim skips dead letters, and replay
-- clears `deadLetteredAt` before delivery is possible — so this predicate loses no rows.
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_dead_letter_idx"
  ON "AuthzedProjectionOutbox"("isRevocation", "deadLetteredAt")
  WHERE "processedAt" IS NULL AND "deadLetteredAt" IS NOT NULL;

-- History prune. The only index that carries delivered rows.
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_processed_idx"
  ON "AuthzedProjectionOutbox"("processedAt")
  WHERE "processedAt" IS NOT NULL;

/**
 * Does this UPDATE provably leave the projected relationship set a superset of what it was?
 *
 * `isRevocation` has exactly one reader: the fail-closed freshness guard. So the question it must
 * answer is "could an undelivered copy of this event leave SpiceDB granting access that PostgreSQL
 * has taken away?" — a property of how the projectors *write*, not of the permission closure in
 * authzed/schema.zed. Deriving it from that closure would put a second, untestable copy of the
 * schema here; deriving it from the write shape keeps it checkable against the reconcilers.
 *
 * Deny by default. An unmapped target type, an unmapped column, or any enum move is a revocation.
 * In particular the role ladder is deliberately NOT encoded: OrganizationRole is rankable, but a
 * rank table here has no compile-time backstop the way relationship-map.ts does, so adding a role
 * to schema.zed would silently make this wrong in the fail-OPEN direction. Role changes are
 * one-at-a-time admin actions rather than the bulk operations this classifier exists to keep off
 * the guard, so denying them costs nothing. Revisit only if a bulk re-roling path appears.
 */
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
    WHEN TG_OP = 'INSERT' THEN false
    WHEN TG_OP = 'DELETE' THEN true
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

DROP TRIGGER IF EXISTS "authzed_projection_organization" ON "Organization";
CREATE TRIGGER "authzed_projection_organization"
AFTER INSERT OR DELETE ON "Organization"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('organization', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_membership" ON "Membership";
CREATE TRIGGER "authzed_projection_membership"
AFTER INSERT OR DELETE OR UPDATE OF "role", "accepted", "organizationId", "userId" ON "Membership"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('membership', 'organizationId', 'userId');

DROP TRIGGER IF EXISTS "authzed_projection_user" ON "User";
CREATE TRIGGER "authzed_projection_user"
AFTER INSERT OR DELETE OR UPDATE OF "isActive" ON "User"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('user', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_team" ON "Team";
CREATE TRIGGER "authzed_projection_team"
AFTER INSERT OR DELETE OR UPDATE OF "organizationId" ON "Team"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('team', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_team_user" ON "TeamUser";
CREATE TRIGGER "authzed_projection_team_user"
AFTER INSERT OR DELETE OR UPDATE OF "role", "teamId", "userId" ON "TeamUser"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('team_membership', 'teamId', 'userId');

DROP TRIGGER IF EXISTS "authzed_projection_workspace" ON "Workspace";
CREATE TRIGGER "authzed_projection_workspace"
AFTER INSERT OR DELETE OR UPDATE OF "organizationId" ON "Workspace"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('workspace', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_workspace_team" ON "WorkspaceTeam";
CREATE TRIGGER "authzed_projection_workspace_team"
AFTER INSERT OR DELETE OR UPDATE OF "permission", "workspaceId", "teamId" ON "WorkspaceTeam"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('workspace_team', 'workspaceId', 'teamId');

DROP TRIGGER IF EXISTS "authzed_projection_api_key" ON "ApiKey";
CREATE TRIGGER "authzed_projection_api_key"
AFTER INSERT OR DELETE OR UPDATE OF "organizationId", "organizationAccess" ON "ApiKey"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('api_key', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_api_key_workspace" ON "ApiKeyWorkspace";
CREATE TRIGGER "authzed_projection_api_key_workspace"
AFTER INSERT OR DELETE OR UPDATE OF "permission", "apiKeyId", "workspaceId" ON "ApiKeyWorkspace"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('api_key_workspace', 'apiKeyId', 'workspaceId');

DROP TRIGGER IF EXISTS "authzed_projection_feedback_directory" ON "FeedbackDirectory";
CREATE TRIGGER "authzed_projection_feedback_directory"
AFTER INSERT OR DELETE OR UPDATE OF "isArchived", "organizationId" ON "FeedbackDirectory"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection('feedback_directory', 'id', '');

DROP TRIGGER IF EXISTS "authzed_projection_feedback_directory_workspace" ON "FeedbackDirectoryWorkspace";
CREATE TRIGGER "authzed_projection_feedback_directory_workspace"
AFTER INSERT OR DELETE OR UPDATE OF "feedbackDirectoryId", "workspaceId" ON "FeedbackDirectoryWorkspace"
FOR EACH ROW EXECUTE FUNCTION enqueue_authzed_projection(
  'feedback_directory_assignment',
  'feedbackDirectoryId',
  'workspaceId'
);
