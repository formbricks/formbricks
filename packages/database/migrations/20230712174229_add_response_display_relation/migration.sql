-- AlterTable
ALTER TABLE "Response" ADD COLUMN     "displayId" TEXT;

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_displayId_fkey" FOREIGN KEY ("displayId") REFERENCES "Display"("id") ON DELETE CASCADE ON UPDATE CASCADE;
