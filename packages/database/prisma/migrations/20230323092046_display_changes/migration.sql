/*
  Warnings:

  - You are about to drop the column `allowMultipleDisplays` on the `Survey` table. All the data in the column will be lost.
  - You are about to drop the column `allowMultipleResponses` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "allowMultipleDisplays",
DROP COLUMN "allowMultipleResponses",
ADD COLUMN     "displayOptions" TEXT NOT NULL DEFAULT 'displayOnce';
