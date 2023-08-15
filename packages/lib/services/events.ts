import "server-only";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { Prisma } from "@prisma/client";
import { cache } from "react";

export const getEvents = cache(async (environmentId: string): Promise<any[]> => {
  let eventsPrisma;
  try {
    eventsPrisma = await prisma.event.findMany({
      where: {
        eventClass: {
          environmentId: environmentId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
      include: {
        eventClass: true,
      },
    });

    return eventsPrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
});
