-- Remove isAIDataAnalysisEnabled — feature flag added prematurely before any AI data analysis
-- feature existed. Will be reintroduced at the directory level when the feature is built.
ALTER TABLE "Organization" DROP COLUMN IF EXISTS "isAIDataAnalysisEnabled";
