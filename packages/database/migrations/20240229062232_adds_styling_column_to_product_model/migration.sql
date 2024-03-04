-- AlterTable
ALTER TABLE "Product" ADD COLUMN "styling" JSONB DEFAULT '{"unifiedStyling":true,"allowStyleOverwrite":true,"brandColor":{"light":"#64748b"}}';
CREATE INDEX idx_product_styling ON "Product" USING gin ("styling");