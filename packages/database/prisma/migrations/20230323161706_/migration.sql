/*
  Warnings:

  - You are about to drop the column `displayOptions` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "displayOptions",
ADD COLUMN     "displayOption" "displayOptions" NOT NULL DEFAULT 'displayOnce';
