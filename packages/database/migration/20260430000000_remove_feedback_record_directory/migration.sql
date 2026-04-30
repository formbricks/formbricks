-- DropForeignKey
ALTER TABLE "ApiKeyFeedbackRecordDirectory" DROP CONSTRAINT "ApiKeyFeedbackRecordDirectory_apiKeyId_fkey";

-- DropForeignKey
ALTER TABLE "ApiKeyFeedbackRecordDirectory" DROP CONSTRAINT "ApiKeyFeedbackRecordDirectory_feedbackRecordDirectoryId_fkey";

-- DropForeignKey
ALTER TABLE "Chart" DROP CONSTRAINT "Chart_feedbackRecordDirectoryId_fkey";

-- DropForeignKey
ALTER TABLE "Connector" DROP CONSTRAINT "Connector_feedbackRecordDirectoryId_fkey";

-- DropForeignKey
ALTER TABLE "FeedbackRecordDirectory" DROP CONSTRAINT "FeedbackRecordDirectory_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "FeedbackRecordDirectoryWorkspace" DROP CONSTRAINT "FeedbackRecordDirectoryWorkspace_feedbackRecordDirectoryId_fkey";

-- DropForeignKey
ALTER TABLE "FeedbackRecordDirectoryWorkspace" DROP CONSTRAINT "FeedbackRecordDirectoryWorkspace_workspaceId_fkey";

-- DropIndex
DROP INDEX "Chart_feedbackRecordDirectoryId_idx";

-- DropIndex
DROP INDEX "Connector_feedbackRecordDirectoryId_idx";

-- AlterTable
ALTER TABLE "Chart" DROP COLUMN "feedbackRecordDirectoryId";

-- AlterTable
ALTER TABLE "Connector" DROP COLUMN "feedbackRecordDirectoryId";

-- DropTable
DROP TABLE "ApiKeyFeedbackRecordDirectory";

-- DropTable
DROP TABLE "FeedbackRecordDirectory";

-- DropTable
DROP TABLE "FeedbackRecordDirectoryWorkspace";
