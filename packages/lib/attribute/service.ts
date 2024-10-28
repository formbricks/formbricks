import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TAttributes } from "@formbricks/types/attributes";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";
import { attributeCache } from "../attribute/cache";
import { getAttributeClassByName } from "../attributeClass/service";
import { cache } from "../cache";
import { getPerson, getPersonByUserId } from "../person/service";
import { validateInputs } from "../utils/validate";

export const selectAttribute: Prisma.AttributeSelect = {
  value: true,
  attributeClass: {
    select: {
      name: true,
      id: true,
    },
  },
};

// convert prisma attributes to a key-value object
const convertPrismaAttributes = (prismaAttributes: any): TAttributes => {
  return prismaAttributes.reduce(
    (acc, attr) => {
      acc[attr.attributeClass.name] = attr.value;
      return acc;
    },
    {} as Record<string, string | number>
  );
};

export const getAttributes = reactCache(
  (personId: string): Promise<TAttributes> =>
    cache(
      async () => {
        validateInputs([personId, ZId]);

        try {
          const prismaAttributes = await prisma.attribute.findMany({
            where: {
              personId,
            },
            select: selectAttribute,
          });

          return convertPrismaAttributes(prismaAttributes);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getAttributes-${personId}`],
      {
        tags: [attributeCache.tag.byPersonId(personId)],
      }
    )()
);

export const getAttributesByUserId = reactCache(
  (environmentId: string, userId: string): Promise<TAttributes> =>
    cache(
      async () => {
        validateInputs([environmentId, ZId], [userId, ZString]);

        const person = await getPersonByUserId(environmentId, userId);

        if (!person) {
          throw new Error("Person not found");
        }

        try {
          const prismaAttributes = await prisma.attribute.findMany({
            where: {
              personId: person.id,
            },
            select: selectAttribute,
          });

          return convertPrismaAttributes(prismaAttributes);
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }

          throw error;
        }
      },
      [`getAttributesByUserId-${environmentId}-${userId}`],
      {
        tags: [attributeCache.tag.byEnvironmentIdAndUserId(environmentId, userId)],
      }
    )()
);

export const getAttribute = (name: string, personId: string): Promise<string | undefined> =>
  cache(
    async () => {
      validateInputs([name, ZString], [personId, ZId]);

      const person = await getPerson(personId);

      if (!person) {
        throw new Error("Person not found");
      }

      const attributeClass = await getAttributeClassByName(person?.environmentId, name);

      if (!attributeClass) {
        return undefined;
      }

      try {
        const prismaAttributes = await prisma.attribute.findFirst({
          where: {
            attributeClassId: attributeClass.id,
            personId,
          },
          select: { value: true },
        });

        return prismaAttributes?.value;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }

        throw error;
      }
    },
    [`getAttribute-${name}-${personId}`],
    {
      tags: [attributeCache.tag.byNameAndPersonId(name, personId)],
    }
  )();
