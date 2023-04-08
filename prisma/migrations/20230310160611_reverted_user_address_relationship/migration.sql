/*
  Warnings:

  - You are about to drop the column `addressId` on the `users` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Address` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_addressId_fkey";

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "userId" INTEGER;

DO $$DECLARE temp_user record;
BEGIN
  FOR temp_user IN (SELECT "id", "addressId" FROM public."users" WHERE public."users"."addressId" IS NOT NULL)
  LOOP
    UPDATE public."Address" SET "userId"=temp_user."id" WHERE "id"=temp_user."addressId";
  END LOOP;
END$$;

ALTER TABLE "Address" ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "addressId";

-- CreateIndex
CREATE UNIQUE INDEX "Address_userId_key" ON "Address"("userId");

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
