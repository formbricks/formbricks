/*
  Warnings:

  - You are about to drop the column `tags` on the `Response` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PipelineTriggers" AS ENUM ('responseCreated', 'responseUpdated', 'responseFinished');

-- AlterTable
ALTER TABLE "Response" DROP COLUMN "tags";

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "triggers" "PipelineTriggers"[],

    CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Webhook" ADD CONSTRAINT "Webhook_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
