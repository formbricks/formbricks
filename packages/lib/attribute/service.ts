import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@formbricks/database";
import { TAttributes, ZAttributes } from "@formbricks/types/attributes";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";

import { attributeCache } from "../attribute/cache";
import { attributeClassCache } from "../attributeClass/cache";
import { getAttributeClassByName, getAttributeClasses } from "../attributeClass/service";
import { cache } from "../cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
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

export const getAttributes = (personId: string): Promise<TAttributes> =>
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getAttributesByUserId = (environmentId: string, userId: string): Promise<TAttributes> =>
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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

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
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const updateAttributes = async (personId: string, attributes: TAttributes): Promise<boolean> => {
  validateInputs([personId, ZId], [attributes, ZAttributes]);

  const person = await getPerson(personId);

  if (!person) {
    throw new Error("Person not found");
  }

  const environmentId = person.environmentId;
  const userId = person.userId;

  const attributeClasses = await getAttributeClasses(environmentId);

  const attributeClassMap = new Map(attributeClasses.map((ac) => [ac.name, ac.id]));
  const upsertOperations: Promise<any>[] = [];

  for (const [name, value] of Object.entries(attributes)) {
    const attributeClassId = attributeClassMap.get(name);

    if (attributeClassId) {
      // Class exists, perform an upsert operation
      upsertOperations.push(
        prisma.attribute
          .upsert({
            select: {
              id: true,
            },
            where: {
              personId_attributeClassId: {
                personId,
                attributeClassId,
              },
            },
            update: {
              value,
            },
            create: {
              personId,
              attributeClassId,
              value,
            },
          })
          .then(() => {
            attributeCache.revalidate({ environmentId, personId, userId, name });
          })
      );
    } else {
      // Class does not exist, create new class and attribute
      upsertOperations.push(
        prisma.attributeClass
          .create({
            select: { id: true },
            data: {
              name,
              type: "code",
              environment: {
                connect: {
                  id: environmentId,
                },
              },
              attributes: {
                create: {
                  personId,
                  value,
                },
              },
            },
          })
          .then(({ id }) => {
            attributeClassCache.revalidate({ id, environmentId, name });
            attributeCache.revalidate({ environmentId, personId, userId, name });
          })
      );
    }
  }

  // Execute all upsert operations concurrently
  await Promise.all(upsertOperations);

  return true;
};
