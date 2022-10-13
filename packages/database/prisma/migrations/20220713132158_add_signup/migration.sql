/*
  Warnings:

  - You are about to drop the column `name` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `verification_requests` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `email` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `password` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Form" DROP CONSTRAINT "Form_ownerId_fkey";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "name",
ADD COLUMN     "firstname" TEXT,
ADD COLUMN     "lastname" TEXT,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "password" SET NOT NULL;

-- DropTable
DROP TABLE "verification_requests";

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
