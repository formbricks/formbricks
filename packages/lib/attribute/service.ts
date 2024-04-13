import "server-only";

import { Prisma } from "@prisma/client";
import { attributeCache } from "attribute/cache";
import { unstable_cache } from "next/cache";
import { getPersonByUserId } from "person/service";
import { validateInputs } from "utils/validate";

import { prisma } from "@formbricks/database";
import { TAttributes } from "@formbricks/types/attributes";
import { ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError } from "@formbricks/types/errors";

import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

export const selectAttribute = {
  value: true,
  attributeClass: {
    select: {
      name: true,
      id: true,
    },
  },
};

export const getAttributesByUserId = async (
  environmentId: string,
  userId: string
): Promise<TAttributes | null> => {
  return await unstable_cache(
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

        // convert prisma attributes to a key-value object
        const attributes = prismaAttributes.reduce(
          (acc, attr) => {
            acc[attr.attributeClass.name] = attr.value;
            return acc;
          },
          {} as Record<string, string | number>
        );

        return attributes;
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
};
