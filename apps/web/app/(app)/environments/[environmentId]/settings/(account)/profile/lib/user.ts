import { cache } from "@/lib/cache";
import { userCache } from "@/lib/user/cache";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { User } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const getUserById = reactCache(
  async (userId: string): Promise<Pick<User, "password" | "identityProvider">> =>
    cache(
      async () => {
        const user = await prisma.user.findUnique({
          where: {
            id: userId,
          },
          select: {
            password: true,
            identityProvider: true,
          },
        });
        if (!user) {
          throw new ResourceNotFoundError("user", userId);
        }
        return user;
      },
      [`getUserById-${userId}`],
      {
        tags: [userCache.tag.byId(userId)],
      }
    )()
);

export const verifyUserPassword = async (userId: string, password: string): Promise<boolean> => {
  const user = await getUserById(userId);

  if (user.identityProvider !== "email" || !user.password) {
    throw new InvalidInputError("Password is not set for this user");
  }

  const isCorrectPassword = await verifyPassword(password, user.password);

  if (!isCorrectPassword) {
    return false;
  }

  return true;
};

export const getIsEmailUnique = reactCache(
  async (email: string): Promise<boolean> =>
    cache(
      async () => {
        const user = await prisma.user.findUnique({
          where: {
            email: email.toLowerCase(),
          },
          select: {
            id: true,
          },
        });

        return !user;
      },
      [`getIsEmailUnique-${email}`],
      {
        tags: [userCache.tag.byEmail(email)],
      }
    )()
);
