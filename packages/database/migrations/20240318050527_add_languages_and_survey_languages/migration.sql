-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "language" TEXT;

-- CreateTable
CREATE TABLE "Language" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "alias" TEXT,
    "productId" TEXT NOT NULL,

    CONSTRAINT "Language_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyLanguage" (
    "languageId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "default" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SurveyLanguage_pkey" PRIMARY KEY ("languageId","surveyId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Language_productId_code_key" ON "Language"("productId", "code");

-- CreateIndex
CREATE INDEX "SurveyLanguage_surveyId_idx" ON "SurveyLanguage"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyLanguage_languageId_idx" ON "SurveyLanguage"("languageId");

-- AddForeignKey
ALTER TABLE "Language" ADD CONSTRAINT "Language_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyLanguage" ADD CONSTRAINT "SurveyLanguage_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyLanguage" ADD CONSTRAINT "SurveyLanguage_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
