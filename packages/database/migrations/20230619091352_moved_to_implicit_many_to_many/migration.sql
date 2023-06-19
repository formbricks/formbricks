/*
  Warnings:

  - You are about to drop the `TagsOnResponses` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TagsOnResponses" DROP CONSTRAINT "TagsOnResponses_responseId_fkey";

-- DropForeignKey
ALTER TABLE "TagsOnResponses" DROP CONSTRAINT "TagsOnResponses_tagId_fkey";

-- DropTable
DROP TABLE "TagsOnResponses";

-- CreateTable
CREATE TABLE "_ResponseToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ResponseToTag_AB_unique" ON "_ResponseToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_ResponseToTag_B_index" ON "_ResponseToTag"("B");

-- AddForeignKey
ALTER TABLE "_ResponseToTag" ADD CONSTRAINT "_ResponseToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ResponseToTag" ADD CONSTRAINT "_ResponseToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
