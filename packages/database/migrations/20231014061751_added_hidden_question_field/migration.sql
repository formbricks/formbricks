-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "hiddenQuestionCard" JSONB NOT NULL DEFAULT '{"enabled": true}';
