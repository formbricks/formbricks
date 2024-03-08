-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "styling" JSONB DEFAULT '{"unifiedStyling":false,"allowStyleOverwrite":true}',
ALTER COLUMN "brandColor" DROP NOT NULL,
ALTER COLUMN "brandColor" DROP DEFAULT;
