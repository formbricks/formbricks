/*
  Warnings:

  - You are about to drop the column `plan` on the `Team` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `Team` table. All the data in the column will be lost.
  - Added the required column `subscription` to the `Team` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Team" DROP COLUMN "plan",
DROP COLUMN "stripeCustomerId",
ADD COLUMN     "subscription" JSONB NOT NULL;

-- DropEnum
DROP TYPE "Plan";
