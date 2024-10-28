"use server";

import "server-only";
import { Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { prisma } from "@formbricks/database";
import {
  TAttributeClass,
  TAttributeClassType,
  TAttributeClassUpdateInput,
  ZAttributeClassType,
  ZAttributeClassUpdateInput,
} from "@formbricks/types/attribute-classes";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, OperationNotAllowedError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { ITEMS_PER_PAGE, MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT } from "../constants";
import { validateInputs } from "../utils/validate";
import { attributeClassCache } from "./cache";

export const getAttributeClass = reactCache(
  async (attributeClassId: string): Promise<TAttributeClass | null> =>
    cache(
      async () => {
        validateInputs([attributeClassId, ZId]);

        try {
          const attributeClass = await prisma.attributeClass.findFirst({
            where: {
              id: attributeClassId,
            },
          });

          return attributeClass;
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            throw new DatabaseError(error.message);
          }
          throw error;
        }
      },
      [`getAttributeClass-${attributeClassId}`],
      {
        tags: [attributeClassCache.tag.byId(attributeClassId)],
      }
    )()
);

export const getAttributeClassByName = reactCache((environmentId: string, name: string) =>
  cache(
    async (): Promise<TAttributeClass | null> => {
      validateInputs([environmentId, ZId], [name, ZString]);

      try {
        const attributeClass = await prisma.attributeClass.findFirst({
          where: {
            environmentId,
            name,
          },
        });

        return attributeClass;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
          throw new DatabaseError(error.message);
        }
        throw error;
      }
    },
    [`getAttributeClassByName-${environmentId}-${name}`],
    {
      tags: [attributeClassCache.tag.byEnvironmentIdAndName(environmentId, name)],
    }
  )()
);
