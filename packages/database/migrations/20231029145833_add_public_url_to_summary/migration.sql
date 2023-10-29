-- CreateTable
CREATE TABLE "ResponseSharingKey" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyId" TEXT NOT NULL,

    CONSTRAINT "ResponseSharingKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseSharingKey_id_key" ON "ResponseSharingKey"("id");

-- AddForeignKey
ALTER TABLE "ResponseSharingKey" ADD CONSTRAINT "ResponseSharingKey_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
