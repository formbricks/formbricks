import { prisma } from "@formbricks/database";
import type { Person } from "@formbricks/types/js";

const select = {
  id: true,
  environmentId: true,
  attributes: {
    select: {
      id: true,
      value: true,
      attributeClass: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },
};

export const createPerson = async (environmentId: string): Promise<Person> => {
  return await prisma.person.create({
    data: {
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
    select,
  });
};
