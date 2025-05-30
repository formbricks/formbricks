-- CreateTable
CREATE TABLE "UserSocial" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "socialAvatar" TEXT,
    "socialId" TEXT NOT NULL,
    "socialName" TEXT NOT NULL,
    "socialEmail" TEXT NOT NULL,
    "provider" TEXT NOT NULL,

    CONSTRAINT "UserSocial_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "UserSocial" ADD CONSTRAINT "UserSocial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
