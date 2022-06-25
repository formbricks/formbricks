/*
  Warnings:

  - You are about to drop the column `published` on the `Form` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Form" DROP COLUMN "published";

-- AlterTable
ALTER TABLE "NoCodeForm" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false;
