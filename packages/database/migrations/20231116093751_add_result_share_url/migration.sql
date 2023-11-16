-- CreateTable
CREATE TABLE "ResultShareUrl" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyId" TEXT NOT NULL,

    CONSTRAINT "ResultShareUrl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultShareUrl_id_key" ON "ResultShareUrl"("id");

-- AddForeignKey
ALTER TABLE "ResultShareUrl" ADD CONSTRAINT "ResultShareUrl_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
