import { prisma } from "@formbricks/database";
import { Session } from "@formbricks/types/js";

export const createSession = async (personId: string): Promise<Session> => {
  return prisma.session.create({
    data: {
      person: {
        connect: {
          id: personId,
        },
      },
    },
    select: {
      id: true,
    },
  });
};
