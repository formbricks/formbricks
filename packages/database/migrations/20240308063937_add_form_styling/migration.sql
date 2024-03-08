-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "styling" JSONB DEFAULT '{"unifiedStyling":false,"allowStyleOverwrite":true}';
