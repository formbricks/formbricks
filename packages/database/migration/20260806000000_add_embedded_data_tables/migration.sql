-- CreateEnum
CREATE TYPE "EmbeddedDataSource" AS ENUM ('computed', 'ingested', 'reserved');

-- CreateEnum
CREATE TYPE "EmbeddedDataType" AS ENUM ('string', 'number', 'boolean', 'date');

-- CreateTable
CREATE TABLE "EmbeddedData" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "key" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "EmbeddedDataSource" NOT NULL,
    "dataType" "EmbeddedDataType" NOT NULL DEFAULT 'string',
    "defaultValue" JSONB,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "surveyId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "EmbeddedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyEmbeddedData" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "embeddedDataId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,

    CONSTRAINT "SurveyEmbeddedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmbeddedData_surveyId_idx" ON "EmbeddedData"("surveyId");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedData_workspaceId_key_key" ON "EmbeddedData"("workspaceId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "EmbeddedData_id_workspaceId_key" ON "EmbeddedData"("id", "workspaceId");

-- CreateIndex
CREATE INDEX "SurveyEmbeddedData_embeddedDataId_idx" ON "SurveyEmbeddedData"("embeddedDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyEmbeddedData_surveyId_embeddedDataId_key" ON "SurveyEmbeddedData"("surveyId", "embeddedDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyEmbeddedData_surveyId_storageKey_key" ON "SurveyEmbeddedData"("surveyId", "storageKey");

-- AddForeignKey
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_surveyId_workspaceId_fkey" FOREIGN KEY ("surveyId", "workspaceId") REFERENCES "Survey"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_embeddedDataId_workspaceId_fkey" FOREIGN KEY ("embeddedDataId", "workspaceId") REFERENCES "EmbeddedData"("id", "workspaceId") ON DELETE CASCADE ON UPDATE CASCADE;
