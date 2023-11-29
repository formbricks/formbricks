-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '{"en":"English"}';

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "language" TEXT;
