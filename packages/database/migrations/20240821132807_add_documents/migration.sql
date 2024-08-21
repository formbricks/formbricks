-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('questionResponse');

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "environmentId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "vector" vector(512),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_type_referenceId_idx" ON "Document"("type", "referenceId");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
