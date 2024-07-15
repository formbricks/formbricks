-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "failureCard" JSONB NOT NULL DEFAULT '{"enabled": false}';
