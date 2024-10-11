import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import { TAttributes, ZAttributes } from "@formbricks/types/attributes";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
import { attributeCache } from "../attribute/cache";
import { attributeClassCache } from "../attributeClass/cache";
import {
  getAttributeClassByName,
  getAttributeClasses,
  getAttributeClassesCount,
} from "../attributeClass/service";
import { cache } from "../cache";
import { MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "../constants";
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
  const createOperations: Promise<any>[] = [];
  const newAttributes: { name: string; value: string }[] = [];

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
      // Collect new attributes to be created later
      newAttributes.push({ name, value });
    }
  }

  // Execute all upsert operations concurrently
  await Promise.all(upsertOperations);

  if (newAttributes.length === 0) {
    // short-circuit if no new attributes to create
    return true;
  }

  // Check if new attribute classes will exceed the limit
  const attributeClassCount = await getAttributeClassesCount(environmentId);

  const totalAttributeClassesLength = attributeClassCount + newAttributes.length;

  if (totalAttributeClassesLength > MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT) {
    throw new OperationNotAllowedError(
      `Updating these attributes would exceed the maximum number of attribute classes (${MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT}) for environment ${environmentId}. Existing attributes have been updated.`
    );
  }

  for (const { name, value } of newAttributes) {
    createOperations.push(
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

  // Execute all create operations for new attribute classes
  await Promise.all(createOperations);

  // Revalidate the count cache
  attributeClassCache.revalidate({
    environmentId,
  });

  return true;
};
