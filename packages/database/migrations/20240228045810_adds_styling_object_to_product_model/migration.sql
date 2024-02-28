-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "allowStyleOverwrite" BOOLEAN DEFAULT true,
ADD COLUMN     "styling" JSONB,
ADD COLUMN     "unifiedStyling" BOOLEAN DEFAULT true;
