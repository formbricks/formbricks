/*
  Warnings:

  - Made the column `firstname` on table `users` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastname` on table `users` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Province" AS ENUM ('BU', 'EQ', 'HK', 'HL', 'HU', 'IT', 'KS', 'KC', 'KE', 'KN', 'BC', 'KG', 'KL', 'LO', 'LU', 'MN', 'MA', 'MO', 'NK', 'NU', 'SA', 'SK', 'SU', 'TA', 'TO', 'TU');

-- AlterEnum
ALTER TYPE "PipelineEvent" ADD VALUE 'FORM_OPENED';

-- AlterEnum
ALTER TYPE "PipelineType" ADD VALUE 'AIRTABLE';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "addressId" TEXT,
ADD COLUMN     "date_of_birth" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "photo" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "firstname" SET NOT NULL,
ALTER COLUMN "lastname" SET NOT NULL;

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "commune" TEXT NOT NULL,
    "ville" TEXT NOT NULL,
    "province" "Province" NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE CASCADE ON UPDATE CASCADE;
