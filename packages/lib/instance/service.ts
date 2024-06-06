import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";

import { cache } from "../cache";
import { userCache } from "../user/cache";

// Function to check if there are any users in the database
export const getIsFreshInstance = (): Promise<boolean> =>
  cache(
    async () => {
      try {
        const userCount = await prisma.user.count();
        if (userCount === 0) return true;
        else return false;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    ["getIsFreshInstance"],
    { tags: [userCache.tag.byCount()] }
  )();
