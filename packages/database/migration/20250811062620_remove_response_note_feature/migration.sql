/*
  Warnings:

  - You are about to drop the `ResponseNote` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ResponseNote" DROP CONSTRAINT "ResponseNote_responseId_fkey";

-- DropForeignKey
ALTER TABLE "ResponseNote" DROP CONSTRAINT "ResponseNote_userId_fkey";

-- DropTable
DROP TABLE "ResponseNote";
