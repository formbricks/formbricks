/*
  Warnings:

  - The values [Bas_Uele,Equateur,Haut_Katanga,Haut_Lomami,Haut_Uele,Ituri,Kasai,Kasai_Central,Kasai_Oriental,Kinshasa,Kongo_Central,Kwango,Kwilu,Lomami,Lualaba,Mai_Ndombe,Maniema,Mongala,Nord_Kivu,Nord_Ubangi,Sankuru,Sud_Kivu,Sud_Ubangi,Tanganyika,Tshopo,Tshuapa] on the enum `Province` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Province_new" AS ENUM ('BU', 'EQ', 'HK', 'HL', 'HU', 'IT', 'KS', 'KC', 'KE', 'KN', 'BC', 'KG', 'KL', 'LO', 'LU', 'MN', 'MA', 'MO', 'NK', 'NU', 'SA', 'SK', 'SU', 'TA', 'TO', 'TU');
ALTER TABLE "Address" ALTER COLUMN "province" TYPE "Province_new" USING ("province"::text::"Province_new");
ALTER TYPE "Province" RENAME TO "Province_old";
ALTER TYPE "Province_new" RENAME TO "Province";
DROP TYPE "Province_old";
COMMIT;

-- AlterTable
ALTER TABLE "Address" ALTER COLUMN "line1" SET DEFAULT '',
ALTER COLUMN "commune" SET DEFAULT '',
ALTER COLUMN "ville" SET DEFAULT '',
ALTER COLUMN "province" SET DEFAULT 'KN';
