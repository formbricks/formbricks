/*
  Warnings:

  - You are about to drop the column `productId` on the `Tag` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[environmentId,name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `environmentId` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_productId_fkey";

-- DropIndex
DROP INDEX "Tag_productId_name_key";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "productId",
ADD COLUMN     "environmentId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_environmentId_name_key" ON "Tag"("environmentId", "name");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
