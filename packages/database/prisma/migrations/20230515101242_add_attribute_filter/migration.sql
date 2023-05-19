-- CreateEnum
CREATE TYPE "SurveyAttributeFilterCondition" AS ENUM ('equals', 'notEquals');

-- CreateTable
CREATE TABLE "SurveyAttributeFilter" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "attributeClassId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "condition" "SurveyAttributeFilterCondition" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SurveyAttributeFilter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SurveyAttributeFilter_surveyId_attributeClassId_key" ON "SurveyAttributeFilter"("surveyId", "attributeClassId");

-- AddForeignKey
ALTER TABLE "SurveyAttributeFilter" ADD CONSTRAINT "SurveyAttributeFilter_attributeClassId_fkey" FOREIGN KEY ("attributeClassId") REFERENCES "AttributeClass"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyAttributeFilter" ADD CONSTRAINT "SurveyAttributeFilter_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
