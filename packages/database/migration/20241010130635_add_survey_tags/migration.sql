-- CreateTable
CREATE TABLE "_SurveyToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SurveyToTag_AB_unique" ON "_SurveyToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_SurveyToTag_B_index" ON "_SurveyToTag"("B");

-- AddForeignKey
ALTER TABLE "_SurveyToTag" ADD CONSTRAINT "_SurveyToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SurveyToTag" ADD CONSTRAINT "_SurveyToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
