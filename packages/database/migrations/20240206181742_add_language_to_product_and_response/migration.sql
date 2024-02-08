-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[{"id":"en","default":true,"alias":null}]';

-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "language" TEXT;
