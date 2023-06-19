/*
  Warnings:

  - You are about to drop the column `redirectLink` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "redirectLink" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "redirectLink";
