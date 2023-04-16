-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "thankYouCard" JSONB NOT NULL DEFAULT '{"enabled": false}';
