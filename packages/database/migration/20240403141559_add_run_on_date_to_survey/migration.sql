-- AlterEnum
ALTER TYPE "SurveyStatus" ADD VALUE 'scheduled';

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "runOnDate" TIMESTAMP(3);
