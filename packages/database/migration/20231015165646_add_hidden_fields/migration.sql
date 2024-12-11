-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "hiddenFields" JSONB NOT NULL DEFAULT '{"enabled": false}';
