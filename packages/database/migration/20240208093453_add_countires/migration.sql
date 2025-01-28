-- CreateTable
CREATE TABLE "Country" (
    "isoCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("isoCode")
);

-- CreateTable
CREATE TABLE "_SurveyCountries" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_SurveyCountries_AB_unique" ON "_SurveyCountries"("A", "B");

-- CreateIndex
CREATE INDEX "_SurveyCountries_B_index" ON "_SurveyCountries"("B");

-- AddForeignKey
ALTER TABLE "_SurveyCountries" ADD CONSTRAINT "_SurveyCountries_A_fkey" FOREIGN KEY ("A") REFERENCES "Country"("isoCode") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SurveyCountries" ADD CONSTRAINT "_SurveyCountries_B_fkey" FOREIGN KEY ("B") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
