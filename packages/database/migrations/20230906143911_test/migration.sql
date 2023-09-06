-- DropForeignKey
ALTER TABLE "Survey" DROP CONSTRAINT "Survey_userSegmentId_fkey";

-- AddForeignKey
ALTER TABLE "Survey" ADD CONSTRAINT "Survey_userSegmentId_fkey" FOREIGN KEY ("userSegmentId") REFERENCES "UserSegment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
