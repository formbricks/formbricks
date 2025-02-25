-- AlterTable
ALTER TABLE "Response" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Survey" ADD COLUMN     "isBackButtonHidden" BOOLEAN NOT NULL DEFAULT false;
