-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "metadata" JSONB DEFAULT '{}';
UPDATE "Survey" SET "metadata" = '{}' WHERE "metadata" IS NULL;