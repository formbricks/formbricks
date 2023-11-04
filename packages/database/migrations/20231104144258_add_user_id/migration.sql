/*
  Warnings:

  - A unique constraint covering the columns `[environmentId,userId]` on the table `Person` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "userId" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Person_environmentId_userId_key" ON "Person"("environmentId", "userId");
