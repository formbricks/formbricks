/*
  Warnings:

  - You are about to drop the column `failed` on the `Response` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Response" DROP COLUMN "failed";

-- AlterTable
ALTER TABLE "Survey" ALTER COLUMN "failureCard" DROP NOT NULL,
ALTER COLUMN "failureCard" DROP DEFAULT;
