-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('draft', 'inProgress', 'paused', 'completed', 'archived');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "status" "SurveyStatus" NOT NULL DEFAULT 'draft';
