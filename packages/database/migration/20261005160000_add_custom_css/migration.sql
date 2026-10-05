-- Nullable additions preserve existing surveys and require no backfill.
ALTER TABLE "Workspace" ADD COLUMN "customCss" JSONB;
ALTER TABLE "Survey" ADD COLUMN "customCss" JSONB;
