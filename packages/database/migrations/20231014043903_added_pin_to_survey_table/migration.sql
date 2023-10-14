/*
  Warnings:

  - You are about to drop the column `backupCodes` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorEnabled` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `twoFactorSecret` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Product_teamId_name_key";

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "pin" INTEGER;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "backupCodes",
DROP COLUMN "twoFactorEnabled",
DROP COLUMN "twoFactorSecret";
