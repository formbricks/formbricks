/*
  Warnings:

  - You are about to drop the column `show` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "show",
ADD COLUMN     "allowMultipleDisplays" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowMultipleResponses" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "recontactDays" INTEGER;

-- DropEnum
DROP TYPE "ShowOptions";
