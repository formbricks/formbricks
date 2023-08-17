/*
  Warnings:

  - You are about to drop the `_SurveyToUserSegment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_SurveyToUserSegment" DROP CONSTRAINT "_SurveyToUserSegment_A_fkey";

-- DropForeignKey
ALTER TABLE "_SurveyToUserSegment" DROP CONSTRAINT "_SurveyToUserSegment_B_fkey";

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "userSegmentId" TEXT;

-- AlterTable
ALTER TABLE "UserSegment" ALTER COLUMN "filters" SET DEFAULT '[]';

-- DropTable
DROP TABLE "_SurveyToUserSegment";

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userSegmentId_fkey" FOREIGN KEY ("userSegmentId") REFERENCES "UserSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
