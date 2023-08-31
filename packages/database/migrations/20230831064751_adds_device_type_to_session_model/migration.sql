-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('mobile', 'desktop');

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "deviceType" "DeviceType";
