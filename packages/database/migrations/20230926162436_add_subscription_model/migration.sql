/*
  Warnings:

  - You are about to drop the column `plan` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `Team` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Team" DROP COLUMN "plan",
DROP COLUMN "stripeCustomerId",
ADD COLUMN     "subscription" JSONB;

-- DropEnum
DROP TYPE "Plan";
