/*
  Warnings:

  - The values [BU,EQ,HK,HL,HU,IT,KS,KC,KE,KN,BC,KG,KL,LO,LU,MN,MA,MO,NK,NU,SA,SK,SU,TA,TO,TU] on the enum `Province` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `pictureProfile` on the `users` table. All the data in the column will be lost.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Province_new" AS ENUM ('Bas_Uele', 'Equateur', 'Haut_Katanga', 'Haut_Lomami', 'Haut_Uele', 'Ituri', 'Kasai', 'Kasai_Central', 'Kasai_Oriental', 'Kinshasa', 'Kongo_Central', 'Kwango', 'Kwilu', 'Lomami', 'Lualaba', 'Mai_Ndombe', 'Maniema', 'Mongala', 'Nord_Kivu', 'Nord_Ubangi', 'Sankuru', 'Sud_Kivu', 'Sud_Ubangi', 'Tanganyika', 'Tshopo', 'Tshuapa');
ALTER TABLE "Address" ALTER COLUMN "province" DROP DEFAULT;
ALTER TABLE "Address" ALTER COLUMN "province" TYPE "Province_new" USING ("province"::text::"Province_new");
ALTER TYPE "Province" RENAME TO "Province_old";
ALTER TYPE "Province_new" RENAME TO "Province";
DROP TYPE "Province_old";
COMMIT;

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "line1" DROP DEFAULT,
ALTER COLUMN "commune" DROP DEFAULT,
ALTER COLUMN "ville" DROP DEFAULT,
ALTER COLUMN "province" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "pictureProfile",
ADD COLUMN     "photo" TEXT;
