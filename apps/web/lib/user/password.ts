import "server-only";
import { User } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { verifyPassword } from "@/modules/auth/lib/utils";

export const getUserAuthenticationData = reactCache(
  async (
    userId: string
  ): Promise<Pick<User, "email" | "password" | "identityProvider" | "identityProviderAccountId">> => {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        email: true,
        password: true,
        identityProvider: true,
        identityProviderAccountId: true,
      },
    });

    if (!user) {
      throw new ResourceNotFoundError("user", userId);
    }

    return user;
  }
);

export const verifyUserPassword = async (userId: string, password: string): Promise<boolean> => {
  const user = await getUserAuthenticationData(userId);

  if (!user.password) {
    throw new InvalidInputError("Password is not set for this user");
  }

  return await verifyPassword(password, user.password);
};
