import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { TUserLocale } from "@formbricks/types/user";

export const getUserEmail = reactCache(async (userId: string): Promise<string | null> => {
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
});

export const getUserLocale = reactCache(async (id: string): Promise<TUserLocale | undefined> => {
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
});
