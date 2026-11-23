-- Dashboard Access Control (P-ENG-110): Member attributes, team dashboard limits, Dashboard pages with
-- team limits, widget kinds (chart, image, text, separator) and per-dataset Dashboard Viewer access.
--
-- This release upgrades in a maintenance window (ADR-0059): stop writers, run migrations, run
-- `upgrade prepare` (which applies the SpiceDB schema and drains the outbox), restart. There is no
-- rolling-upgrade fallback: `DashboardWidget.pageId` is required from the start, and the previous
-- release's widget writes don't set it.
--
-- Every existing dashboard gets one page called "Overview", and its widgets move onto it, so existing
-- Dashboard Viewers see exactly what they saw before (no page or team limits exist yet).
--
-- One transaction for the whole file. Types, tables, columns, indexes and foreign keys are guarded so
-- the file converges on a database built with `db:push`.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$ BEGIN
  CREATE TYPE "DashboardWidgetKind" AS ENUM ('chart', 'image', 'text', 'separator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DashboardViewerAccessJoin" AS ENUM ('all', 'any');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberAttributeKey" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "MemberAttributeKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberAttributeValue" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attributeKeyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,

    CONSTRAINT "MemberAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "InviteAttributeValue" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inviteId" TEXT NOT NULL,
    "attributeKeyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "normalizedValue" TEXT NOT NULL,

    CONSTRAINT "InviteAttributeValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TeamDashboard" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,

    CONSTRAINT "TeamDashboard_pkey" PRIMARY KEY ("teamId","dashboardId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DashboardPage" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DashboardPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "DashboardPageTeam" (
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,

    CONSTRAINT "DashboardPageTeam_pkey" PRIMARY KEY ("pageId","teamId")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeedbackDirectoryViewerCondition" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "feedbackDirectoryId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "attributeKeyId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FeedbackDirectoryViewerCondition_pkey" PRIMARY KEY ("id")
);

-- Widgets move onto pages. The column is added nullable, filled, then made required.
ALTER TABLE "DashboardWidget" ADD COLUMN IF NOT EXISTS "content" JSONB;
ALTER TABLE "DashboardWidget" ADD COLUMN IF NOT EXISTS "kind" "DashboardWidgetKind" NOT NULL DEFAULT 'chart';
ALTER TABLE "DashboardWidget" ADD COLUMN IF NOT EXISTS "pageId" TEXT;
ALTER TABLE "DashboardWidget" ALTER COLUMN "chartId" DROP NOT NULL;
ALTER TABLE "FeedbackDirectory" ADD COLUMN IF NOT EXISTS "viewerAccessJoin" "DashboardViewerAccessJoin" NOT NULL DEFAULT 'all';

-- One "Overview" page per dashboard that has none yet. The id only has to be unique; cuid-shaped ids
-- are not required by anything that reads pages.
INSERT INTO "DashboardPage" ("id", "created_at", "updated_at", "dashboardId", "name", "order")
SELECT 'pg' || substr(md5(d."id" || ':overview'), 1, 23), NOW(), NOW(), d."id", 'Overview', 0
FROM "Dashboard" d
WHERE NOT EXISTS (SELECT 1 FROM "DashboardPage" p WHERE p."dashboardId" = d."id");

-- squawk-ignore adding-not-nullable-field
UPDATE "DashboardWidget" w
SET "pageId" = (
  SELECT p."id" FROM "DashboardPage" p WHERE p."dashboardId" = w."dashboardId" ORDER BY p."order", p."created_at", p."id" LIMIT 1
)
WHERE w."pageId" IS NULL;

-- squawk-ignore adding-required-field
ALTER TABLE "DashboardWidget" ALTER COLUMN "pageId" SET NOT NULL;

DROP INDEX IF EXISTS "DashboardWidget_dashboardId_chartId_key";

-- The new tables are empty and DashboardWidget is small (bounded per dashboard), so plain index builds
-- inside the maintenance window block nothing that matters.
-- squawk-ignore require-concurrent-index-creation
-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberAttributeKey_organizationId_created_at_idx" ON "MemberAttributeKey"("organizationId", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MemberAttributeKey_organizationId_key_key" ON "MemberAttributeKey"("organizationId", "key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberAttributeValue_userId_organizationId_idx" ON "MemberAttributeValue"("userId", "organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberAttributeValue_attributeKeyId_normalizedValue_idx" ON "MemberAttributeValue"("attributeKeyId", "normalizedValue");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MemberAttributeValue_attributeKeyId_userId_normalizedValue_key" ON "MemberAttributeValue"("attributeKeyId", "userId", "normalizedValue");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InviteAttributeValue_attributeKeyId_idx" ON "InviteAttributeValue"("attributeKeyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InviteAttributeValue_inviteId_attributeKeyId_normalizedValu_key" ON "InviteAttributeValue"("inviteId", "attributeKeyId", "normalizedValue");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TeamDashboard_dashboardId_idx" ON "TeamDashboard"("dashboardId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DashboardPage_dashboardId_order_idx" ON "DashboardPage"("dashboardId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DashboardPageTeam_teamId_idx" ON "DashboardPageTeam"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeedbackDirectoryViewerCondition_feedbackDirectoryId_order_idx" ON "FeedbackDirectoryViewerCondition"("feedbackDirectoryId", "order");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeedbackDirectoryViewerCondition_attributeKeyId_idx" ON "FeedbackDirectoryViewerCondition"("attributeKeyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DashboardWidget_chartId_idx" ON "DashboardWidget"("chartId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DashboardWidget_pageId_chartId_key" ON "DashboardWidget"("pageId", "chartId");

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "MemberAttributeKey" ADD CONSTRAINT "MemberAttributeKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "MemberAttributeValue" ADD CONSTRAINT "MemberAttributeValue_attributeKeyId_fkey" FOREIGN KEY ("attributeKeyId") REFERENCES "MemberAttributeKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "MemberAttributeValue" ADD CONSTRAINT "MemberAttributeValue_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "Membership"("userId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "InviteAttributeValue" ADD CONSTRAINT "InviteAttributeValue_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "InviteAttributeValue" ADD CONSTRAINT "InviteAttributeValue_attributeKeyId_fkey" FOREIGN KEY ("attributeKeyId") REFERENCES "MemberAttributeKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "TeamDashboard" ADD CONSTRAINT "TeamDashboard_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "TeamDashboard" ADD CONSTRAINT "TeamDashboard_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "DashboardPage" ADD CONSTRAINT "DashboardPage_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "DashboardPageTeam" ADD CONSTRAINT "DashboardPageTeam_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DashboardPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "DashboardPageTeam" ADD CONSTRAINT "DashboardPageTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "DashboardWidget" ADD CONSTRAINT "DashboardWidget_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "DashboardPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "FeedbackDirectoryViewerCondition" ADD CONSTRAINT "FeedbackDirectoryViewerCondition_feedbackDirectoryId_fkey" FOREIGN KEY ("feedbackDirectoryId") REFERENCES "FeedbackDirectory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "FeedbackDirectoryViewerCondition" ADD CONSTRAINT "FeedbackDirectoryViewerCondition_attributeKeyId_fkey" FOREIGN KEY ("attributeKeyId") REFERENCES "MemberAttributeKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
