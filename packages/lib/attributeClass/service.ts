"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import {
  TAttributeClass,
  TAttributeClassUpdateInput,
  ZAttributeClassUpdateInput,
  TAttributeClassType,
} from "@formbricks/types/v1/attributeClasses";
import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { revalidateTag, unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { ZOptionalNumber } from "@formbricks/types/v1/common";

const attributeClassesCacheTag = (environmentId: string): string =>
  `environments-${environmentId}-attributeClasses`;

const getAttributeClassesCacheKey = (environmentId: string): string[] => [
  attributeClassesCacheTag(environmentId),
];

export const getAttributeClass = async (attributeClassId: string): Promise<TAttributeClass | null> => {
  validateInputs([attributeClassId, ZId]);
  try {
    const attributeClass = await prisma.attributeClass.findFirst({
      where: {
        id: attributeClassId,
      },
    });
    return attributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching attributeClass with id ${attributeClassId}`);
  }
};

export const getAttributeClasses = async (
  environmentId: string,
  page?: number
): Promise<TAttributeClass[]> => {
  validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

  try {
    const attributeClasses = await prisma.attributeClass.findMany({
      where: {
        environmentId: environmentId,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: page ? ITEMS_PER_PAGE : undefined,
      skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
    });

    return attributeClasses;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching attributeClasses for environment ${environmentId}`);
  }
};

export const updatetAttributeClass = async (
  attributeClassId: string,
  data: Partial<TAttributeClassUpdateInput>
): Promise<TAttributeClass | null> => {
  validateInputs([attributeClassId, ZId], [data, ZAttributeClassUpdateInput.partial()]);
  try {
    const attributeClass = await prisma.attributeClass.update({
      where: {
        id: attributeClassId,
      },
      data: {
        description: data.description,
        archived: data.archived,
      },
    });

    revalidateTag(attributeClassesCacheTag(attributeClass.environmentId));

    return attributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when updating attribute class with id ${attributeClassId}`);
  }
};

export const getAttributeClassByNameCached = async (environmentId: string, name: string) =>
  await unstable_cache(
    async (): Promise<TAttributeClass | null> => {
      return await getAttributeClassByName(environmentId, name);
    },
    [`environments-${environmentId}-attributeClass-${name}`],
    {
      tags: getAttributeClassesCacheKey(environmentId),
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getAttributeClassByName = async (
  environmentId: string,
  name: string
): Promise<TAttributeClass | null> => {
  const attributeClass = await prisma.attributeClass.findFirst({
    where: {
      environmentId,
      name,
    },
  });
  return attributeClass;
};

export const createAttributeClass = async (
  environmentId: string,
  name: string,
  type: TAttributeClassType
): Promise<TAttributeClass | null> => {
  const attributeClass = await prisma.attributeClass.create({
    data: {
      name,
      type,
      environment: {
        connect: {
          id: environmentId,
        },
      },
    },
  });
  revalidateTag(attributeClassesCacheTag(environmentId));
  return attributeClass;
};

export const deleteAttributeClass = async (attributeClassId: string): Promise<TAttributeClass> => {
  validateInputs([attributeClassId, ZId]);
  try {
    const deletedAttributeClass = await prisma.attributeClass.delete({
      where: {
        id: attributeClassId,
      },
    });

    return deletedAttributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when deleting webhook with ID ${attributeClassId}`);
  }
};
