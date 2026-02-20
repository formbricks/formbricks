-- CreateEnum
CREATE TYPE "public"."ConnectorType" AS ENUM ('formbricks', 'csv');

-- CreateEnum
CREATE TYPE "public"."ConnectorStatus" AS ENUM ('active', 'paused', 'error');

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
    "error_message" TEXT,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConnectorFormbricksMapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectorId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "elementId" TEXT NOT NULL,
    "hubFieldType" TEXT NOT NULL,
    "custom_field_label" TEXT,

    CONSTRAINT "ConnectorFormbricksMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConnectorFieldMapping" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "connectorId" TEXT NOT NULL,
    "source_field_id" TEXT NOT NULL,
    "target_field_id" TEXT NOT NULL,
    "static_value" TEXT,

    CONSTRAINT "ConnectorFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Connector_environmentId_idx" ON "public"."Connector"("environmentId");

-- CreateIndex
CREATE INDEX "Connector_type_idx" ON "public"."Connector"("type");

-- CreateIndex
CREATE INDEX "ConnectorFormbricksMapping_connectorId_idx" ON "public"."ConnectorFormbricksMapping"("connectorId");

-- CreateIndex
CREATE INDEX "ConnectorFormbricksMapping_surveyId_idx" ON "public"."ConnectorFormbricksMapping"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorFormbricksMapping_connectorId_surveyId_elementId_key" ON "public"."ConnectorFormbricksMapping"("connectorId", "surveyId", "elementId");

-- CreateIndex
CREATE INDEX "ConnectorFieldMapping_connectorId_idx" ON "public"."ConnectorFieldMapping"("connectorId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectorFieldMapping_connectorId_source_field_id_target_fi_key" ON "public"."ConnectorFieldMapping"("connectorId", "source_field_id", "target_field_id");

CREATE UNIQUE INDEX "Connector_environmentId_name_key" ON "public"."Connector"("environmentId", "name");

-- AddForeignKey
ALTER TABLE "public"."Connector" ADD CONSTRAINT "Connector_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "public"."Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "public"."Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConnectorFormbricksMapping" ADD CONSTRAINT "ConnectorFormbricksMapping_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "public"."Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConnectorFieldMapping" ADD CONSTRAINT "ConnectorFieldMapping_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "public"."Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
