-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "EmbeddingType" AS ENUM ('questionResponse');

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "environmentId" TEXT NOT NULL,
    "type" "EmbeddingType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "vector" vector(512),

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Embedding_type_referenceId_idx" ON "Embedding"("type", "referenceId");

-- AddForeignKey
ALTER TABLE "Embedding" ADD CONSTRAINT "Embedding_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
