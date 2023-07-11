import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TSession } from "@formbricks/types/v1/sessions";
import { Prisma } from "@prisma/client";

const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  personId: true,
};

export const createSession = async (personId: string): Promise<TSession> => {
  try {
    const session = await prisma.session.create({
      data: {
        person: {
          connect: {
            id: personId,
          },
        },
      },
      select,
    });

    return session;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError("Database operation failed");
    }

    throw error;
  }
};
