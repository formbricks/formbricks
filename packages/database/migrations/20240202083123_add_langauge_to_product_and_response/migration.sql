-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '{"en":"English","_default_":"en"}';

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "language" TEXT;
