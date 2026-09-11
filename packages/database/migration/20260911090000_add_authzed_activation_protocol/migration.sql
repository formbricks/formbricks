-- Durable v5 -> v6 AuthZed activation protocol.
--
-- The database is the only authority for cutover state. The application, Helm chart, Docker
-- installer, and standalone upgrade assistant all use these records instead of trusting a Boolean
-- acknowledgement in deployment configuration.

-- Prisma executes SQL migration files without an implicit transaction. Keep the activation tables
-- and triggers atomic so a failed deployment cannot leave a partially installed fence. The partial
-- claim index is built concurrently by the immediately following migration.
BEGIN;

SET LOCAL lock_timeout = '1s';
DO $$
BEGIN
  CREATE TYPE "AuthzedAuthorizationAuthority" AS ENUM ('legacy', 'spicedb');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE "AuthzedAuthorizationTransition" AS ENUM (
    'idle', 'preparing', 'prepared', 'activating', 'rollback_fencing', 'rolling_back'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE "AuthzedActivationReceiptStatus" AS ENUM (
    'prepared', 'active', 'rolled_back', 'invalidated'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE "AuthzedActivationKind" AS ENUM ('fresh_install', 'upgrade');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  CREATE TYPE "AuthzedUpgradeRunStatus" AS ENUM ('pending', 'running', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AuthzedAuthorizationControl" (
  "id" TEXT NOT NULL DEFAULT 'formbricks',
  "authority" "AuthzedAuthorizationAuthority" NOT NULL DEFAULT 'legacy',
  "transition" "AuthzedAuthorizationTransition" NOT NULL DEFAULT 'idle',
  "generation" BIGINT NOT NULL DEFAULT 0,
  "pendingReceiptId" TEXT,
  "activeReceiptId" TEXT,
  "mutationFenceExpiresAt" TIMESTAMP(3),
  "maintenanceLeaseOwner" TEXT,
  "maintenanceLeaseExpiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthzedAuthorizationControl_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthzedAuthorizationControl_singleton_check" CHECK ("id" = 'formbricks')
);

CREATE TABLE IF NOT EXISTS "AuthzedActivationReceipt" (
  "id" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "kind" "AuthzedActivationKind" NOT NULL,
  "status" "AuthzedActivationReceiptStatus" NOT NULL DEFAULT 'prepared',
  "protocolVersion" INTEGER NOT NULL,
  "contractDigest" TEXT NOT NULL,
  "schemaDigest" TEXT NOT NULL,
  "clientConfigDigest" TEXT NOT NULL,
  "bridgeImageDigest" TEXT,
  "bridgeManifestDigest" TEXT,
  "candidateImageDigest" TEXT,
  "candidateManifestDigest" TEXT NOT NULL,
  "sourceSequenceWatermark" BIGINT NOT NULL,
  "completedAtSnapshot" TEXT,
  "auditCounters" JSONB NOT NULL,
  "outboxCounters" JSONB NOT NULL,
  "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "rolledBackAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthzedActivationReceipt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthzedActivationReceipt_generation_key" UNIQUE ("generation"),
  CONSTRAINT "AuthzedActivationReceipt_protocolVersion_check" CHECK ("protocolVersion" > 0),
  CONSTRAINT "AuthzedActivationReceipt_contractDigest_check"
    CHECK ("contractDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_schemaDigest_check"
    CHECK ("schemaDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_clientConfigDigest_check"
    CHECK ("clientConfigDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_bridgeImageDigest_check"
    CHECK ("bridgeImageDigest" IS NULL OR "bridgeImageDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_bridgeManifestDigest_check"
    CHECK ("bridgeManifestDigest" IS NULL OR "bridgeManifestDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_candidateImageDigest_check"
    CHECK ("candidateImageDigest" IS NULL OR "candidateImageDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_candidateManifestDigest_check"
    CHECK ("candidateManifestDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedActivationReceipt_kind_digests_check" CHECK (
    (
      "kind" = 'fresh_install'
      AND "bridgeImageDigest" IS NULL
      AND "bridgeManifestDigest" IS NULL
      AND "candidateImageDigest" IS NULL
    )
    OR
    (
      "kind" = 'upgrade'
      AND "bridgeImageDigest" IS NOT NULL
      AND "bridgeManifestDigest" IS NOT NULL
      AND "candidateImageDigest" IS NOT NULL
    )
  )
);

CREATE TABLE IF NOT EXISTS "AuthzedUpgradeRun" (
  "id" TEXT NOT NULL,
  "manifestDigest" TEXT NOT NULL,
  "generation" BIGINT NOT NULL,
  "phase" TEXT NOT NULL,
  "status" "AuthzedUpgradeRunStatus" NOT NULL DEFAULT 'pending',
  "privateCursor" JSONB,
  "lastErrorCode" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuthzedUpgradeRun_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuthzedUpgradeRun_manifestDigest_generation_phase_key"
    UNIQUE ("manifestDigest", "generation", "phase"),
  CONSTRAINT "AuthzedUpgradeRun_manifestDigest_check"
    CHECK ("manifestDigest" ~ '^sha256:[0-9a-f]{64}$'),
  CONSTRAINT "AuthzedUpgradeRun_phase_check" CHECK ("phase" ~ '^[a-z][a-z0-9_]{0,63}$')
);

INSERT INTO "AuthzedAuthorizationControl" ("id")
VALUES ('formbricks')
ON CONFLICT ("id") DO NOTHING;

CREATE OR REPLACE FUNCTION authzed_validate_authorization_control()
RETURNS trigger AS $$
BEGIN
  IF NEW."mutationFenceExpiresAt" IS NOT NULL
    AND NEW."mutationFenceExpiresAt" > clock_timestamp() + INTERVAL '15 minutes'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'authzed_activation_fence_too_long';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "authzed_validate_authorization_control" ON "AuthzedAuthorizationControl";
CREATE TRIGGER "authzed_validate_authorization_control"
BEFORE INSERT OR UPDATE ON "AuthzedAuthorizationControl"
FOR EACH ROW EXECUTE FUNCTION authzed_validate_authorization_control();

-- Existing outbox timestamps are not a safe cutover watermark: several events can share one value.
-- New rows receive a monotonic sequence. Pre-migration rows intentionally remain NULL and are always
-- included in bounded drains; avoiding a table rewrite keeps this migration safe for large backlogs.
CREATE SEQUENCE IF NOT EXISTS "AuthzedProjectionOutbox_sourceSequence_seq" AS BIGINT;

ALTER TABLE "AuthzedProjectionOutbox"
  ADD COLUMN IF NOT EXISTS "sourceSequence" BIGINT;

ALTER TABLE "AuthzedProjectionOutbox"
  ALTER COLUMN "sourceSequence" SET DEFAULT nextval('"AuthzedProjectionOutbox_sourceSequence_seq"');

ALTER SEQUENCE "AuthzedProjectionOutbox_sourceSequence_seq"
  OWNED BY "AuthzedProjectionOutbox"."sourceSequence";

-- All product writes that can change authorization source facts take the shared side of this lock.
-- The activation finalizer takes the exclusive side after publishing a short, committed fence. That
-- combination waits for in-flight transactions while making new writes fail immediately rather than
-- queue behind a ten-minute audit.
CREATE OR REPLACE FUNCTION authzed_assert_mutations_allowed()
RETURNS trigger AS $$
DECLARE
  fence_expires_at TIMESTAMP(3);
BEGIN
  SELECT "mutationFenceExpiresAt"
  INTO fence_expires_at
  FROM "AuthzedAuthorizationControl"
  WHERE "id" = 'formbricks';

  IF fence_expires_at IS NOT NULL AND fence_expires_at > clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'authzed_mutations_fenced';
  END IF;

  PERFORM pg_advisory_xact_lock_shared(1179402834, 6);

  -- Close the race where a transaction read the state immediately before the cutover committed its
  -- fence, but had not acquired the shared advisory lock yet.
  SELECT "mutationFenceExpiresAt"
  INTO fence_expires_at
  FROM "AuthzedAuthorizationControl"
  WHERE "id" = 'formbricks';

  IF fence_expires_at IS NOT NULL AND fence_expires_at > clock_timestamp() THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'authzed_mutations_fenced';
  END IF;

  -- Statement-level trigger return values are ignored. Returning NULL avoids pretending a row is
  -- available here and keeps this function valid for every watched statement shape.
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "authzed_mutation_fence_organization" ON "Organization";
CREATE TRIGGER "authzed_mutation_fence_organization"
BEFORE INSERT OR DELETE OR UPDATE OF "id" ON "Organization"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_membership" ON "Membership";
CREATE TRIGGER "authzed_mutation_fence_membership"
BEFORE INSERT OR DELETE OR UPDATE OF "role", "accepted", "organizationId", "userId" ON "Membership"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_user" ON "User";
CREATE TRIGGER "authzed_mutation_fence_user"
BEFORE INSERT OR DELETE OR UPDATE OF "isActive" ON "User"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_team" ON "Team";
CREATE TRIGGER "authzed_mutation_fence_team"
BEFORE INSERT OR DELETE OR UPDATE OF "organizationId" ON "Team"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_team_user" ON "TeamUser";
CREATE TRIGGER "authzed_mutation_fence_team_user"
BEFORE INSERT OR DELETE OR UPDATE OF "role", "teamId", "userId" ON "TeamUser"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_workspace" ON "Workspace";
CREATE TRIGGER "authzed_mutation_fence_workspace"
BEFORE INSERT OR DELETE OR UPDATE OF "organizationId" ON "Workspace"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_workspace_team" ON "WorkspaceTeam";
CREATE TRIGGER "authzed_mutation_fence_workspace_team"
BEFORE INSERT OR DELETE OR UPDATE OF "permission", "workspaceId", "teamId" ON "WorkspaceTeam"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_api_key" ON "ApiKey";
CREATE TRIGGER "authzed_mutation_fence_api_key"
BEFORE INSERT OR DELETE OR UPDATE OF "organizationId", "organizationAccess" ON "ApiKey"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_api_key_workspace" ON "ApiKeyWorkspace";
CREATE TRIGGER "authzed_mutation_fence_api_key_workspace"
BEFORE INSERT OR DELETE OR UPDATE OF "permission", "apiKeyId", "workspaceId" ON "ApiKeyWorkspace"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_feedback_directory" ON "FeedbackDirectory";
CREATE TRIGGER "authzed_mutation_fence_feedback_directory"
BEFORE INSERT OR DELETE OR UPDATE OF "isArchived", "organizationId" ON "FeedbackDirectory"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

DROP TRIGGER IF EXISTS "authzed_mutation_fence_feedback_directory_workspace" ON "FeedbackDirectoryWorkspace";
CREATE TRIGGER "authzed_mutation_fence_feedback_directory_workspace"
BEFORE INSERT OR DELETE OR UPDATE OF "feedbackDirectoryId", "workspaceId" ON "FeedbackDirectoryWorkspace"
FOR EACH STATEMENT EXECUTE FUNCTION authzed_assert_mutations_allowed();

COMMIT;
