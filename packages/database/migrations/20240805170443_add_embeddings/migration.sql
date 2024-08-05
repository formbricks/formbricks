-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "EmbeddingType" AS ENUM ('questionResponse');

-- CreateTable
CREATE TABLE "Embedding" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "type" "EmbeddingType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "vector" vector(512),

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Embedding_type_referenceId_idx" ON "Embedding"("type", "referenceId");
