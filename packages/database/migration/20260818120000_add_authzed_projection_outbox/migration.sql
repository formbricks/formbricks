-- ENG-2408: authorization source changes and their projection intent must commit atomically.
-- PostgreSQL is the durable queue; BullMQ only wakes a worker that claims rows from this table.

CREATE TABLE IF NOT EXISTS "AuthzedProjectionOutbox" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "primaryId" TEXT NOT NULL,
    "secondaryId" TEXT,
    "isRevocation" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
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

CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_pending_idx"
  ON "AuthzedProjectionOutbox"("processedAt", "deadLetteredAt", "availableAt", "createdAt");
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_revocation_idx"
  ON "AuthzedProjectionOutbox"("isRevocation", "processedAt", "deadLetteredAt", "createdAt");
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_leaseExpiresAt_idx"
  ON "AuthzedProjectionOutbox"("leaseExpiresAt");
CREATE INDEX IF NOT EXISTS "AuthzedProjectionOutbox_target_idx"
  ON "AuthzedProjectionOutbox"("targetType", "primaryId", "secondaryId");

CREATE OR REPLACE FUNCTION enqueue_authzed_projection()
RETURNS trigger AS $$
DECLARE
  source jsonb;
  previous_source jsonb;
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
    TG_OP <> 'INSERT',
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
