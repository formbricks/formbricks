-- AlterTable
ALTER TABLE "EventClass" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "Person" ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;
