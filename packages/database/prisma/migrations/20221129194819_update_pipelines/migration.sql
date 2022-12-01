/*
  Warnings:

  - You are about to drop the column `name` on the `Pipeline` table. All the data in the column will be lost.
  - Added the required column `label` to the `Pipeline` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PipelineEvent" AS ENUM ('SUBMISSION_CREATED');

-- AlterTable
ALTER TABLE "Pipeline" DROP COLUMN "name",
ADD COLUMN     "events" "PipelineEvent"[],
ADD COLUMN     "label" TEXT NOT NULL;
