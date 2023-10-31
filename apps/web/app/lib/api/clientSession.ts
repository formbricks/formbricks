import { prisma } from "@formbricks/database";
import { TSession } from "@formbricks/types/sessions";

export const createSession = async (personId: string): Promise<Partial<TSession>> => {
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
