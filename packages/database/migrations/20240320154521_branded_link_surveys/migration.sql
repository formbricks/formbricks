-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "brand" JSONB DEFAULT '{"logoUrl": "", "bgColor": "#ffffff"}';

-- AlterTable
ALTER TABLE "Survey" ALTER COLUMN "styling" SET DEFAULT '{"showLogo": true}';
