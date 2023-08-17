-- CreateTable
CREATE TABLE "UserSegment" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "filters" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "UserSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SurveyToUserSegment" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SurveyToUserSegment_AB_unique" ON "_SurveyToUserSegment"("A", "B");

-- CreateIndex
CREATE INDEX "_SurveyToUserSegment_B_index" ON "_SurveyToUserSegment"("B");

-- AddForeignKey
ALTER TABLE "_SurveyToUserSegment" ADD CONSTRAINT "_SurveyToUserSegment_A_fkey" FOREIGN KEY ("A") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SurveyToUserSegment" ADD CONSTRAINT "_SurveyToUserSegment_B_fkey" FOREIGN KEY ("B") REFERENCES "UserSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
