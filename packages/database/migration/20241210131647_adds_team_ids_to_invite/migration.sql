-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "teamIds" TEXT[] DEFAULT ARRAY[]::TEXT[];