-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "embedding" vector(1024);
