-- CreateEnum
CREATE TYPE "public"."ConnectorType" AS ENUM ('formbricks', 'csv');

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
    "environmentId" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "created_by" TEXT,
    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConnectorFormbricksMapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectorId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
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
    "environmentId" TEXT NOT NULL,
    "source_field_id" TEXT NOT NULL,
    "target_field_id" TEXT NOT NULL,
    "static_value" TEXT,

    CONSTRAINT "ConnectorFieldMapping_pkey" PRIMARY KEY ("id")
);

-- Connector indexes
CREATE UNIQUE INDEX "Connector_id_environmentId_key" ON "public"."Connector"("id", "environmentId");
CREATE UNIQUE INDEX "Connector_environmentId_name_key" ON "public"."Connector"("environmentId", "name");
CREATE INDEX "Connector_type_idx" ON "public"."Connector"("type");

-- ConnectorFormbricksMapping indexes
CREATE UNIQUE INDEX "ConnectorFormbricksMapping_environmentId_connectorId_survey_key" ON "public"."ConnectorFormbricksMapping"("environmentId", "connectorId", "surveyId", "elementId");
CREATE INDEX "ConnectorFormbricksMapping_environmentId_surveyId_idx" ON "public"."ConnectorFormbricksMapping"("environmentId", "surveyId");
CREATE INDEX "ConnectorFormbricksMapping_surveyId_idx" ON "public"."ConnectorFormbricksMapping"("surveyId");

-- ConnectorFieldMapping indexes
CREATE UNIQUE INDEX "ConnectorFieldMapping_environmentId_connectorId_source_fiel_key" ON "public"."ConnectorFieldMapping"("environmentId", "connectorId", "source_field_id", "target_field_id");

-- Survey composite unique (for composite FK from ConnectorFormbricksMapping)
CREATE UNIQUE INDEX "Survey_id_environmentId_key" ON "public"."Survey"("id", "environmentId");

-- Foreign keys: Connector -> Environment, Connector -> User (creator)
ALTER TABLE "public"."Connector" ADD CONSTRAINT "Connector_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "public"."Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."Connector" ADD CONSTRAINT "Connector_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: ConnectorFormbricksMapping -> Connector (composite), Survey (composite)
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_connectorId_environmentId_fkey" FOREIGN KEY ("connectorId", "environmentId") REFERENCES "public"."Connector"("id", "environmentId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_surveyId_environmentId_fkey" FOREIGN KEY ("surveyId", "environmentId") REFERENCES "public"."Survey"("id", "environmentId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys: ConnectorFieldMapping -> Connector (composite)
ALTER TABLE "public"."ConnectorFieldMapping" ADD CONSTRAINT "ConnectorFieldMapping_connectorId_environmentId_fkey" FOREIGN KEY ("connectorId", "environmentId") REFERENCES "public"."Connector"("id", "environmentId") ON DELETE CASCADE ON UPDATE CASCADE;
