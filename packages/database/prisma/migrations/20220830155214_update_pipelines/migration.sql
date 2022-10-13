/*
  Warnings:

  - Added the required column `name` to the `Pipeline` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PipelineEvent" AS ENUM ('PAGE_SUBMISSION');

-- AlterTable
ALTER TABLE "Pipeline" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "events" "PipelineEvent"[],
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "data" SET DEFAULT '{}';
