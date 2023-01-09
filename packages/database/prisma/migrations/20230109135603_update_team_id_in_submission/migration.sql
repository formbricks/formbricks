/*
  Warnings:

  - You are about to drop the column `teamId` on the `Submission` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_customerId_teamId_fkey";

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "teamId",
ADD COLUMN     "customerTeamId" TEXT;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_customerId_customerTeamId_fkey" FOREIGN KEY ("customerId", "customerTeamId") REFERENCES "Customer"("id", "teamId") ON DELETE SET NULL ON UPDATE CASCADE;
