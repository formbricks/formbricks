-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "numberOfResponses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responseCount" INTEGER DEFAULT 0;
