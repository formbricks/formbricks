-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[{"id":"en","default":true,"alias":"English"}]';

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "language" TEXT;
