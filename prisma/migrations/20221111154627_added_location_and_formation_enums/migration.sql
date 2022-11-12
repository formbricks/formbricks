/*
  Warnings:

  - The `place` column on the `Form` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Location" AS ENUM ('Goma', 'Lubumbashi', 'Kinshasa', 'Autre');

-- CreateEnum
CREATE TYPE "Formation" AS ENUM ('DEV', 'SMD', 'AUTRE');

-- AlterTable
ALTER TABLE "Form" ADD COLUMN     "formation" "Formation" NOT NULL DEFAULT 'AUTRE',
DROP COLUMN "place",
ADD COLUMN     "place" "Location" NOT NULL DEFAULT 'Autre';
