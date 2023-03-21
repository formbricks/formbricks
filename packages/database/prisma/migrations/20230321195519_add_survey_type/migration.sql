-- CreateEnum
CREATE TYPE "SurveyType" AS ENUM ('email', 'link', 'mobile', 'web');

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'web';
