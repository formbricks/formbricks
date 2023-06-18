/*
  Warnings:

  - You are about to drop the `_ProductToTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ResponseToTag` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[productId,name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `productId` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_ProductToTag" DROP CONSTRAINT "_ProductToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_ProductToTag" DROP CONSTRAINT "_ProductToTag_B_fkey";

-- DropForeignKey
ALTER TABLE "_ResponseToTag" DROP CONSTRAINT "_ResponseToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_ResponseToTag" DROP CONSTRAINT "_ResponseToTag_B_fkey";

-- DropIndex
DROP INDEX "Tag_name_key";

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "productId" TEXT NOT NULL;

-- DropTable
DROP TABLE "_ProductToTag";

-- DropTable
DROP TABLE "_ResponseToTag";

-- CreateTable
CREATE TABLE "TagsOnResponses" (
    "responseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TagsOnResponses_pkey" PRIMARY KEY ("responseId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_productId_name_key" ON "Tag"("productId", "name");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagsOnResponses" ADD CONSTRAINT "TagsOnResponses_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagsOnResponses" ADD CONSTRAINT "TagsOnResponses_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
