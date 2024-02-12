/*
  Warnings:

  - A unique constraint covering the columns `[environmentId,title]` on the table `Segment` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Segment_environmentId_title_key" ON "Segment"("environmentId", "title");
