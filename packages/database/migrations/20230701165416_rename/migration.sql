/*
  Warnings:

  - You are about to drop the column `closeDate` on the `Survey` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "closeDate",
ADD COLUMN     "closeOnDate" TIMESTAMP(3);
