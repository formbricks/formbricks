/*
  Warnings:

  - You are about to drop the column `isActive` on the `UserSegment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSegment" DROP COLUMN "isActive",
ADD COLUMN     "private" BOOLEAN NOT NULL DEFAULT true;
