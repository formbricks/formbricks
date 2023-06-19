/*
  Warnings:

  - You are about to drop the `_ResponseToTag` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_ResponseToTag" DROP CONSTRAINT "_ResponseToTag_A_fkey";

-- DropForeignKey
ALTER TABLE "_ResponseToTag" DROP CONSTRAINT "_ResponseToTag_B_fkey";

-- DropTable
DROP TABLE "_ResponseToTag";

-- CreateTable
CREATE TABLE "TagsOnResponses" (
    "responseId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "TagsOnResponses_pkey" PRIMARY KEY ("responseId","tagId")
);

-- AddForeignKey
ALTER TABLE "TagsOnResponses" ADD CONSTRAINT "TagsOnResponses_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagsOnResponses" ADD CONSTRAINT "TagsOnResponses_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
