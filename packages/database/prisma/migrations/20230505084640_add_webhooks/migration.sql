/*
  Warnings:

  - You are about to drop the column `tags` on the `Response` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "PipelineTriggers" AS ENUM ('responseCreated', 'responseUpdated', 'responseFinished');

-- AlterTable
ALTER TABLE "Response" DROP COLUMN "tags";

-- AlterTable
ALTER TABLE "Webhook" ADD COLUMN     "triggers" "PipelineTriggers"[];
