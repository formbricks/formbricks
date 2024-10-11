-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "welcomeCard" JSONB NOT NULL DEFAULT '{"enabled": false}';
