import { cache } from "@/lib/cache";
import { userCache } from "@/lib/user/cache";
import { verifyPassword } from "@/modules/auth/lib/utils";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";

export const verifyUserPassword = reactCache(
  async (userId: string, password: string): Promise<boolean> =>
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

        if (user.identityProvider !== "email" || !user.password) {
          throw new InvalidInputError("Third party login is already enabled");
        }

        const isCorrectPassword = await verifyPassword(password, user.password);

        if (!isCorrectPassword) {
          return false;
        }

        return true;
      },
      [`verifyUserPassword-${userId}`],
      {
        tags: [userCache.tag.byId(userId)],
      }
    )()
);

export const checkUserExistsByEmail = reactCache(
  async (email: string): Promise<boolean> =>
    cache(
      async () => {
        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          select: {
            id: true,
          },
        });

        return !!user;
      },
      [`checkUserExistsByEmail-${email}`],
      {
        tags: [userCache.tag.byEmail(email)],
      }
    )()
);
