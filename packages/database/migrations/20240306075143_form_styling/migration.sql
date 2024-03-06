-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "styling" JSONB DEFAULT '{"unifiedStyling":true,"allowStyleOverwrite":true}';
