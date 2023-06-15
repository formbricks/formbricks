import { TPerson } from "@formbricks/types/v1/people";
import { prisma } from "@formbricks/database";

type TransformPersonInput = {
  id: string;
  attributes: {
    value: string;
    attributeClass: {
      name: string;
    };
  }[];
};

type TransformPersonOutput = {
  id: string;
  attributes: Record<string, string | number>;
};

export const transformPrismaPerson = (person: TransformPersonInput | null): TransformPersonOutput | null => {
  if (person === null) {
    return null;
  }

  const attributes = person.attributes.reduce((acc, attr) => {
    acc[attr.attributeClass.name] = attr.value;
    return acc;
  }, {} as Record<string, string | number>);

  return {
    id: person.id,
    attributes: attributes,
  };
};

export const getPerson = async (personId: string): Promise<TPerson | null> => {
  const personPrisma = await prisma.person.findUnique({
    where: {
      id: personId,
    },
    include: {
      attributes: {
        include: {
          attributeClass: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  const person = transformPrismaPerson(personPrisma);

  return person;
};
