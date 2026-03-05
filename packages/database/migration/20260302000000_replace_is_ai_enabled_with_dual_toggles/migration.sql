-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "isAISmartToolsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "isAIDataAnalysisEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" DROP COLUMN "isAIEnabled";
