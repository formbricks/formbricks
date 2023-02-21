/*
  Warnings:

  - Added the required column `addressId` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date_of_birth` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Province" AS ENUM ('Bas_Uele', 'Equateur', 'Haut_Katanga', 'Haut_Lomami', 'Haut_Uele', 'Ituri', 'Kasai', 'Kasai_Central', 'Kasai_Oriental', 'Kinshasa', 'Kongo_Central', 'Kwango', 'Kwilu', 'Lomami', 'Lualaba', 'Mai_Ndombe', 'Maniema', 'Mongala', 'Nord_Kivu', 'Nord_Ubangi', 'Sankuru', 'Sud_Kivu', 'Sud_Ubangi', 'Tanganyika', 'Tshopo', 'Tshuapa');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "addressId" TEXT NOT NULL,
ADD COLUMN     "date_of_birth" DATE NOT NULL;

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
