/*
  Warnings:

  - You are about to drop the column `private` on the `UserSegment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "UserSegment" DROP COLUMN "private",
ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT true;
