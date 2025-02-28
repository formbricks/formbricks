-- AlterEnum
ALTER TYPE "IdentityProvider" ADD VALUE 'saml';

-- AlterTable
ALTER TABLE "Response" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
