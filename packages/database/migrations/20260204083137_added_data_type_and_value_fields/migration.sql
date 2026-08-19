-- CreateEnum
CREATE TYPE "public"."ContactAttributeDataType" AS ENUM ('string', 'number', 'date');

-- AlterTable
ALTER TABLE "public"."ContactAttribute" ADD COLUMN     "valueDate" TIMESTAMP(3),
ADD COLUMN     "valueNumber" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "public"."ContactAttributeKey" ADD COLUMN     "dataType" "public"."ContactAttributeDataType" NOT NULL DEFAULT 'string';

-- CreateIndex
CREATE INDEX "ContactAttribute_attributeKeyId_valueNumber_idx" ON "public"."ContactAttribute"("attributeKeyId", "valueNumber");

-- CreateIndex
CREATE INDEX "ContactAttribute_attributeKeyId_valueDate_idx" ON "public"."ContactAttribute"("attributeKeyId", "valueDate");
