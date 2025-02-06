import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { cache } from "@formbricks/lib/cache";
import { userCache } from "@formbricks/lib/user/cache";
import { DatabaseError } from "@formbricks/types/errors";
import { TUserLocale } from "@formbricks/types/user";

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
      [`survey-templates-getUserLocale-${id}`],
      {
        tags: [userCache.tag.byId(id)],
      }
    )()
);
