-- CreateEnum
CREATE TYPE "DisplayStatus" AS ENUM ('seen', 'responded');

-- CreateTable
CREATE TABLE "Display" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "surveyId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "DisplayStatus" NOT NULL DEFAULT 'seen',

    CONSTRAINT "Display_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Display_surveyId_personId_key" ON "Display"("surveyId", "personId");

-- AddForeignKey
ALTER TABLE "Display" ADD CONSTRAINT "Display_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Display" ADD CONSTRAINT "Display_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
