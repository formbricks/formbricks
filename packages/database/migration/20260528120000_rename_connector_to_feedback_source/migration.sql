-- Rename Connector domain to FeedbackSource (Unify Feedback). The word
-- "Connector" is reserved for the upcoming Workflows domain.
--
-- This migration renames the three tables, their two enums, foreign-key
-- columns (connectorId -> feedback_source_id), indexes, constraints, and
-- foreign-key relationships in place. Data is preserved.

-- Rename enums
ALTER TYPE "ConnectorType" RENAME TO "FeedbackSourceType";
ALTER TYPE "ConnectorStatus" RENAME TO "FeedbackSourceStatus";

-- Rename tables
ALTER TABLE "Connector" RENAME TO "FeedbackSource";
ALTER TABLE "ConnectorFormbricksMapping" RENAME TO "FeedbackSourceFormbricksMapping";
ALTER TABLE "ConnectorFieldMapping" RENAME TO "FeedbackSourceFieldMapping";

-- Rename foreign-key columns (connectorId -> feedback_source_id)
ALTER TABLE "FeedbackSourceFormbricksMapping"
  RENAME COLUMN "connectorId" TO "feedback_source_id";
ALTER TABLE "FeedbackSourceFieldMapping"
  RENAME COLUMN "connectorId" TO "feedback_source_id";

-- Rename the primary-key constraint on each renamed table
ALTER INDEX "Connector_pkey" RENAME TO "FeedbackSource_pkey";
ALTER INDEX "ConnectorFormbricksMapping_pkey" RENAME TO "FeedbackSourceFormbricksMapping_pkey";
ALTER INDEX "ConnectorFieldMapping_pkey" RENAME TO "FeedbackSourceFieldMapping_pkey";

-- Rename indexes on the FeedbackSource table
ALTER INDEX "Connector_id_workspaceId_key" RENAME TO "FeedbackSource_id_workspaceId_key";
ALTER INDEX "Connector_workspaceId_name_key" RENAME TO "FeedbackSource_workspaceId_name_key";
ALTER INDEX "Connector_type_idx" RENAME TO "FeedbackSource_type_idx";

-- Rename indexes on FeedbackSourceFormbricksMapping
ALTER INDEX "ConnectorFormbricksMapping_workspaceId_connectorId_surveyId_elementId_key"
  RENAME TO "FeedbackSourceFormbricksMapping_workspaceId_feedbackSourceId_surveyId_elementId_key";
ALTER INDEX "ConnectorFormbricksMapping_workspaceId_surveyId_idx"
  RENAME TO "FeedbackSourceFormbricksMapping_workspaceId_surveyId_idx";
ALTER INDEX "ConnectorFormbricksMapping_surveyId_idx"
  RENAME TO "FeedbackSourceFormbricksMapping_surveyId_idx";

-- Rename indexes on FeedbackSourceFieldMapping
ALTER INDEX "ConnectorFieldMapping_workspaceId_connectorId_sourceFieldId_targetFieldId_key"
  RENAME TO "FeedbackSourceFieldMapping_workspaceId_feedbackSourceId_sourceFieldId_targetFieldId_key";

-- Rename foreign-key constraints on FeedbackSource itself
ALTER TABLE "FeedbackSource"
  RENAME CONSTRAINT "Connector_workspaceId_fkey" TO "FeedbackSource_workspaceId_fkey";
ALTER TABLE "FeedbackSource"
  RENAME CONSTRAINT "Connector_created_by_fkey" TO "FeedbackSource_created_by_fkey";

-- Rename foreign-key constraints on FeedbackSourceFormbricksMapping
ALTER TABLE "FeedbackSourceFormbricksMapping"
  RENAME CONSTRAINT "ConnectorFormbricksMapping_connectorId_workspaceId_fkey"
  TO "FeedbackSourceFormbricksMapping_feedbackSourceId_workspaceId_fkey";
ALTER TABLE "FeedbackSourceFormbricksMapping"
  RENAME CONSTRAINT "ConnectorFormbricksMapping_surveyId_workspaceId_fkey"
  TO "FeedbackSourceFormbricksMapping_surveyId_workspaceId_fkey";

-- Rename foreign-key constraint on FeedbackSourceFieldMapping
ALTER TABLE "FeedbackSourceFieldMapping"
  RENAME CONSTRAINT "ConnectorFieldMapping_connectorId_workspaceId_fkey"
  TO "FeedbackSourceFieldMapping_feedbackSourceId_workspaceId_fkey";

-- FeedbackDirectory FK (added in a later migration than the original connector model)
-- exists if the connector→directory link was added later; rename if present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Connector_feedbackDirectoryId_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE "FeedbackSource" RENAME CONSTRAINT "Connector_feedbackDirectoryId_fkey" TO "FeedbackSource_feedbackDirectoryId_fkey"';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Connector_feedbackDirectoryId_idx'
  ) THEN
    EXECUTE 'ALTER INDEX "Connector_feedbackDirectoryId_idx" RENAME TO "FeedbackSource_feedbackDirectoryId_idx"';
  END IF;
END$$;
