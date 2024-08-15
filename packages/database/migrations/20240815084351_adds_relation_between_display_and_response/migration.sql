-- AddForeignKey
ALTER TABLE "Display" ADD CONSTRAINT "Display_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response"("id") ON DELETE CASCADE ON UPDATE CASCADE;
