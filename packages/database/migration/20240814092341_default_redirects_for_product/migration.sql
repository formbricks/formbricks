UPDATE "Product"
SET "defaultRedirectOnCompleteUrl" = 'https://member.digiopinion.com/overview'
WHERE "defaultRedirectOnCompleteUrl" IS NULL;

UPDATE "Product"
SET "defaultRedirectOnFailUrl" = 'https://member.digiopinion.com/overview'
WHERE "defaultRedirectOnFailUrl" IS NULL;
-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "defaultRedirectOnCompleteUrl" SET NOT NULL,
ALTER COLUMN "defaultRedirectOnCompleteUrl" SET DEFAULT 'https://member.digiopinion.com/overview',
ALTER COLUMN "defaultRedirectOnFailUrl" SET NOT NULL,
ALTER COLUMN "defaultRedirectOnFailUrl" SET DEFAULT 'https://member.digiopinion.com/overview';
