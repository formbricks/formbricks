-- AlterEnum
ALTER TYPE "IdentityProvider" ADD VALUE 'azuread';

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "ext_expires_in" INTEGER;
