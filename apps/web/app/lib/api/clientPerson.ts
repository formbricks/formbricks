import { prisma } from "@formbricks/database";
import { TPerson } from "@formbricks/types/people";
import { transformPrismaPerson } from "@formbricks/lib/person/service";

const select = {
  id: true,
  environmentId: true,
  createdAt: true,
  updatedAt: true,
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

export const createPerson = async (environmentId: string): Promise<TPerson> => {
  const prismaPerson = await prisma.person.create({
    data: {
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
    select,
  });

  const person = transformPrismaPerson(prismaPerson);
  return person;
};
