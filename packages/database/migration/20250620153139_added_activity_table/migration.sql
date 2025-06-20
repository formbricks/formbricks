-- CreateEnum
CREATE TYPE "ActivityEventType" AS ENUM ('MEMBER_JOINED', 'MEMBER_LEFT', 'ENGAGEMENT_COMPLETED', 'ENGAGEMENT_CREATED', 'REWARD_PAID');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('COMMUNITY', 'USER');

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "activityEvent" "ActivityEventType" NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "metadata" JSONB
);

-- CreateIndex
CREATE UNIQUE INDEX "Activity_id_key" ON "Activity"("id");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
