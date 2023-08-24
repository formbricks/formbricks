import "server-only";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TAction } from "@formbricks/types/v1/actions";
import { Prisma } from "@prisma/client";
import { cache } from "react";

export const getActions = cache(async (environmentId: string, limit? : number): Promise<any> => {
  try {
    const actionsPrisma = await prisma.event.findMany({
      where: {
        eventClass: {
          environmentId: environmentId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit ? limit : 20,
      include: {
        eventClass: true,
      },
    });

    return actionsPrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});
