-- ENG-1833: Embedded Data — workspace-level field definitions + per-survey links.
--
-- Additive only. Nothing reads or writes these tables yet: surveys keep using
-- Survey.hiddenFields / Survey.variables until ENG-1837 repoints readers, and no response
-- data is touched at any point.
--
-- EmbeddedData holds one field definition. A field is either local (bespoke to a single
-- survey, which is how existing variables and hidden fields get migrated in ENG-1835) or
-- shared (part of the workspace library). SurveyEmbeddedData links a survey to a field and
-- records the storage key its value lives under inside that survey.

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
    "isLocal" BOOLEAN NOT NULL DEFAULT true,
    "surveyId" TEXT,
    "workspaceId" TEXT NOT NULL,

    CONSTRAINT "EmbeddedData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurveyEmbeddedData" (
    "id" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "embeddedDataId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,

    CONSTRAINT "SurveyEmbeddedData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmbeddedData_workspaceId_idx" ON "EmbeddedData"("workspaceId");

-- CreateIndex
CREATE INDEX "EmbeddedData_surveyId_idx" ON "EmbeddedData"("surveyId");

-- CreateIndex
-- Only shared fields carry a key. Postgres treats NULLs as distinct, so any number of local
-- fields can coexist in a workspace while the shared library itself stays de-duplicated.
CREATE UNIQUE INDEX "EmbeddedData_workspaceId_key_key" ON "EmbeddedData"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "SurveyEmbeddedData_surveyId_idx" ON "SurveyEmbeddedData"("surveyId");

-- CreateIndex
CREATE INDEX "SurveyEmbeddedData_embeddedDataId_idx" ON "SurveyEmbeddedData"("embeddedDataId");

-- CreateIndex
CREATE UNIQUE INDEX "SurveyEmbeddedData_surveyId_embeddedDataId_key" ON "SurveyEmbeddedData"("surveyId", "embeddedDataId");

-- CreateIndex
-- No two fields inside one survey may share a storage key, which stops a newly linked field
-- from colliding with an existing one and overwriting its response values.
CREATE UNIQUE INDEX "SurveyEmbeddedData_surveyId_storageKey_key" ON "SurveyEmbeddedData"("surveyId", "storageKey");

-- AddForeignKey
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmbeddedData" ADD CONSTRAINT "EmbeddedData_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "Survey"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurveyEmbeddedData" ADD CONSTRAINT "SurveyEmbeddedData_embeddedDataId_fkey" FOREIGN KEY ("embeddedDataId") REFERENCES "EmbeddedData"("id") ON DELETE CASCADE ON UPDATE CASCADE;
