/*
  Warnings:

  - You are about to drop the `Action` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_actionClassId_fkey";

-- DropForeignKey
ALTER TABLE "Action" DROP CONSTRAINT "Action_personId_fkey";

-- DropTable
DROP TABLE "Action";
