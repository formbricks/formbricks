/*
  Warnings:

  - You are about to drop the column `defaultRewardInEuros` on the `Product` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Product" DROP COLUMN "defaultRewardInEuros",
ADD COLUMN     "defaultRewardInUSD" DOUBLE PRECISION NOT NULL DEFAULT 0;
