import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { userCache } from "@formbricks/lib/user/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const getUserEmail = reactCache(
  (userId: string): Promise<string | null> =>
    cache(
      async () => {
        try {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });

          if (!user) {
            return null;
          }

          return user.email;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-editor-getUserEmail-${userId}`],
      {
        tags: [userCache.tag.byId(userId)],
      }
    )()
);
