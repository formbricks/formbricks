/*
  Warnings:

  - You are about to drop the column `isFinished` on the `Form` table. All the data in the column will be lost.
  - You are about to drop the column `isFinished` on the `NoCodeForm` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Form" DROP COLUMN "isFinished",
ADD COLUMN     "questions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responses" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "NoCodeForm" DROP COLUMN "isFinished",
ADD COLUMN     "questions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "responses" INTEGER NOT NULL DEFAULT 0;
