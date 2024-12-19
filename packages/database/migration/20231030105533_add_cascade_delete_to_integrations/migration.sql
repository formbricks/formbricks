-- DropForeignKey
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_environmentId_fkey";

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
