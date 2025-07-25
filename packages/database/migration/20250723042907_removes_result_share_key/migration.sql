/*
  Warnings:

  - You are about to drop the column `resultShareKey` on the `Survey` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Survey_resultShareKey_key";

-- AlterTable
ALTER TABLE "Survey" DROP COLUMN "resultShareKey";
