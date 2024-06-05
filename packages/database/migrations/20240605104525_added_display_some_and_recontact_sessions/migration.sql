-- AlterEnum
ALTER TYPE "displayOptions" ADD VALUE 'displaySome';

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "recontactSessions" INTEGER;
