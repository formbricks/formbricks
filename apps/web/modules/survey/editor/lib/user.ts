import { cache } from "@/lib/cache";
import { userCache } from "@/lib/user/cache";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TUserLocale } from "@formbricks/types/user";

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

export const getUserLocale = reactCache(
  async (id: string): Promise<TUserLocale | undefined> =>
    cache(
      async () => {
        try {
          const user = await prisma.user.findUnique({
            where: {
              id,
            },
            select: {
              locale: true,
            },
          });

          if (!user) {
            return undefined;
          }
          return user.locale;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`survey-editor-getUserLocale-${id}`],
      {
        tags: [userCache.tag.byId(id)],
      }
    )()
);
