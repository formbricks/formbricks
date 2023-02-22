/*
  Warnings:

  - The values [Bas_Uele,Equateur,Haut_Katanga,Haut_Lomami,Haut_Uele,Ituri,Kasai,Kasai_Central,Kasai_Oriental,Kinshasa,Kongo_Central,Kwango,Kwilu,Lomami,Lualaba,Mai_Ndombe,Maniema,Mongala,Nord_Kivu,Nord_Ubangi,Sankuru,Sud_Kivu,Sud_Ubangi,Tanganyika,Tshopo,Tshuapa] on the enum `Province` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Province_new" AS ENUM ('CD_BU', 'CD_EQ', 'CD_HK', 'CD_HL', 'CD_HU', 'CD_IT', 'CD_KS', 'CD_KC', 'CD_KE', 'CD_KN', 'CD_BC', 'CD_KG', 'CD_KL', 'CD_LO', 'CD_LU', 'CD_MN', 'CD_MA', 'CD_MO', 'CD_NK', 'CD_NU', 'CD_SA', 'CD_SK', 'CD_SU', 'CD_TA', 'CD_TO', 'CD_TU');
ALTER TABLE "Address" ALTER COLUMN "province" TYPE "Province_new" USING ("province"::text::"Province_new");
ALTER TYPE "Province" RENAME TO "Province_old";
ALTER TYPE "Province_new" RENAME TO "Province";
DROP TYPE "Province_old";
COMMIT;
