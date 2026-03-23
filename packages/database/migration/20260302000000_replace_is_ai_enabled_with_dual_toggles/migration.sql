-- Step 1: Add new columns
ALTER TABLE "Organization" ADD COLUMN "isAISmartToolsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "isAIDataAnalysisEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Migrate existing data -- organizations that had AI enabled get both new flags set to true
UPDATE "Organization" SET "isAISmartToolsEnabled" = "isAIEnabled", "isAIDataAnalysisEnabled" = "isAIEnabled";

-- Step 3: Drop old column
ALTER TABLE "Organization" DROP COLUMN "isAIEnabled";
