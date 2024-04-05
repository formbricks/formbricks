-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "styling" JSONB NOT NULL DEFAULT '{"allowStyleOverwrite":true}',
ALTER COLUMN "brandColor" DROP NOT NULL,
ALTER COLUMN "brandColor" DROP DEFAULT;
