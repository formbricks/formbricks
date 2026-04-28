-- CreateEnum
CREATE TYPE "public"."ConnectorType" AS ENUM ('formbricks_survey', 'csv');

-- CreateEnum
CREATE TYPE "public"."ConnectorStatus" AS ENUM ('active', 'paused', 'error');

-- CreateEnum
CREATE TYPE "public"."HubFieldType" AS ENUM ('text', 'categorical', 'nps', 'csat', 'ces', 'rating', 'number', 'boolean', 'date');

-- CreateTable
CREATE TABLE "public"."Connector" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."ConnectorType" NOT NULL,
    "status" "public"."ConnectorStatus" NOT NULL DEFAULT 'active',
    "workspaceId" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "created_by" TEXT,
    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConnectorFormbricksMapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectorId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "hubFieldType" "public"."HubFieldType" NOT NULL,
    "custom_field_label" TEXT,

    CONSTRAINT "ConnectorFormbricksMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConnectorFieldMapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectorId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source_field_id" TEXT NOT NULL,
    "target_field_id" TEXT NOT NULL,
    "static_value" TEXT,

    CONSTRAINT "ConnectorFieldMapping_pkey" PRIMARY KEY ("id")
);

-- Connector indexes
CREATE UNIQUE INDEX "Connector_id_workspaceId_key" ON "public"."Connector"("id", "workspaceId");
CREATE UNIQUE INDEX "Connector_workspaceId_name_key" ON "public"."Connector"("workspaceId", "name");
CREATE INDEX "Connector_type_idx" ON "public"."Connector"("type");

-- ConnectorFormbricksMapping indexes
CREATE UNIQUE INDEX "ConnectorFormbricksMapping_workspaceId_connectorId_surveyId_elementId_key" ON "public"."ConnectorFormbricksMapping"("workspaceId", "connectorId", "surveyId", "elementId");
CREATE INDEX "ConnectorFormbricksMapping_workspaceId_surveyId_idx" ON "public"."ConnectorFormbricksMapping"("workspaceId", "surveyId");
CREATE INDEX "ConnectorFormbricksMapping_surveyId_idx" ON "public"."ConnectorFormbricksMapping"("surveyId");

-- ConnectorFieldMapping indexes
CREATE UNIQUE INDEX "ConnectorFieldMapping_workspaceId_connectorId_sourceFieldId_targetFieldId_key" ON "public"."ConnectorFieldMapping"("workspaceId", "connectorId", "source_field_id", "target_field_id");

-- Survey composite unique (for composite FK from ConnectorFormbricksMapping)
CREATE UNIQUE INDEX "Survey_id_workspaceId_key" ON "public"."Survey"("id", "workspaceId");

-- Foreign keys: Connector -> Workspace, Connector -> User (creator)
ALTER TABLE "public"."Connector" ADD CONSTRAINT "Connector_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "public"."Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Connector" ADD CONSTRAINT "Connector_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: ConnectorFormbricksMapping -> Connector (composite), Survey (composite)
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_connectorId_workspaceId_fkey" FOREIGN KEY ("connectorId", "workspaceId") REFERENCES "public"."Connector"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "public"."Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: ConnectorFieldMapping -> Connector (composite)
ALTER TABLE "public"."ConnectorFieldMapping" ADD CONSTRAINT "ConnectorFieldMapping_connectorId_workspaceId_fkey" FOREIGN KEY ("connectorId", "workspaceId") REFERENCES "public"."Connector"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
