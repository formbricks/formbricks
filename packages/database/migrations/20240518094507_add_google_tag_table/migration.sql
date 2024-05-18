-- CreateTable
CREATE TABLE "GoogleTag" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "gtmId" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "surveyIds" TEXT[],

    CONSTRAINT "GoogleTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoogleTag_environmentId_idx" ON "GoogleTag"("environmentId");

-- AddForeignKey
ALTER TABLE "GoogleTag" ADD CONSTRAINT "GoogleTag_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
