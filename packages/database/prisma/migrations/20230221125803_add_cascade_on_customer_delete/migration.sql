-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_customerEmail_customerOrganisationId_fkey";

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_customerEmail_customerOrganisationId_fkey" FOREIGN KEY ("customerEmail", "customerOrganisationId") REFERENCES "Customer"("email", "organisationId") ON DELETE CASCADE ON UPDATE CASCADE;
