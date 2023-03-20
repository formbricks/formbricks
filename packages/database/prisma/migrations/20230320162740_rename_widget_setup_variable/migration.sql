/*
  Warnings:

  - You are about to drop the column `is_widget_setup` on the `Environment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Environment" DROP COLUMN "is_widget_setup",
ADD COLUMN     "widgetSetupCompleted" BOOLEAN NOT NULL DEFAULT false;
