-- MCP grants (ENG-7149, ADR-0041): one row per OAuth connection (user + client) holding its organization &
-- workspace access and an access level per permission, plus the two selection tables ENG-7153 enforces.
-- Additive only: one new enum and three new, empty tables. No existing column changes. The previous
-- release never reads or writes them. The backfill of existing consents is the data migration that follows
-- this one (20261112120001_backfill_mcp_grants).
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. Every type, table, index and constraint is created guarded, and the
-- foreign keys are added apart from the tables, so the file also converges on a database built with
-- `db:push`.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction. The foreign keys lock "User",
-- "oauthClient", "Organization" and "Workspace", all live tables; failing fast beats queueing behind a
-- long-running query.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "McpGrantAccess" AS ENUM ('all', 'organizations', 'workspaces');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "McpGrant" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "access" "McpGrantAccess" NOT NULL DEFAULT 'all',
    "permissions" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "McpGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "McpGrantOrganization" (
    "grantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "McpGrantOrganization_pkey" PRIMARY KEY ("grantId","organizationId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "McpGrantWorkspace" (
    "grantId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "McpGrantWorkspace_pkey" PRIMARY KEY ("grantId","workspaceId")
);

-- The tables are new and empty, so plain index builds block nothing.
-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "McpGrant_clientId_idx" ON "McpGrant"("clientId");

-- squawk-ignore require-concurrent-index-creation
CREATE UNIQUE INDEX IF NOT EXISTS "McpGrant_userId_clientId_key" ON "McpGrant"("userId", "clientId");

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "McpGrantOrganization_organizationId_idx" ON "McpGrantOrganization"("organizationId");

-- squawk-ignore require-concurrent-index-creation
CREATE INDEX IF NOT EXISTS "McpGrantWorkspace_workspaceId_idx" ON "McpGrantWorkspace"("workspaceId");

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrant" ADD CONSTRAINT "McpGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrant" ADD CONSTRAINT "McpGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "oauthClient"("clientId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrantOrganization" ADD CONSTRAINT "McpGrantOrganization_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "McpGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrantOrganization" ADD CONSTRAINT "McpGrantOrganization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrantWorkspace" ADD CONSTRAINT "McpGrantWorkspace_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "McpGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "McpGrantWorkspace" ADD CONSTRAINT "McpGrantWorkspace_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
