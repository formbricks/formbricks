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

export const createPersonWithUser = async (environmentId: string, userId: string): Promise<Person> => {
  const userIdAttributeClass = await prisma.attributeClass.findFirst({
    where: {
      environmentId,
      name: "userId",
    },
    select: {
      id: true,
    },
  });

  if (!userIdAttributeClass) {
    throw new Error("Attribute class not found for the given environmentId");
  }

  return await prisma.person.create({
    data: {
      environment: {
        connect: {
          id: environmentId,
        },
      },
      attributes: {
        create: [
          {
            attributeClass: {
              connect: {
                id: userIdAttributeClass.id,
              },
            },
            value: userId,
          },
        ],
      },
    },
    select,
  });
};
