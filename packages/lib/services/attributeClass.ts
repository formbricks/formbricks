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
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";

const attributeClassesCacheTag = (environmentId: string): string =>
  `environments-${environmentId}-attributeClasses`;

const getAttributeClassesCacheKey = (environmentId: string): string[] => [
  attributeClassesCacheTag(environmentId),
];

export const transformPrismaAttributeClass = (attributeClass: any): TAttributeClass | null => {
  if (attributeClass === null) {
    return null;
  }

  const transformedAttributeClass: TAttributeClass = {
    ...attributeClass,
  };

  return transformedAttributeClass;
};

export const getAttributeClass = cache(async (attributeClassId: string): Promise<TAttributeClass | null> => {
  validateInputs([attributeClassId, ZId]);
  try {
    const attributeClass = await prisma.attributeClass.findFirst({
      where: {
        id: attributeClassId,
      },
    });
    return transformPrismaAttributeClass(attributeClass);
  } catch (error) {
    throw new DatabaseError(`Database error when fetching attributeClass with id ${attributeClassId}`);
  }
});

export const getAttributeClasses = cache(async (environmentId: string): Promise<TAttributeClass[]> => {
  validateInputs([environmentId, ZId]);
  try {
    let attributeClasses = await prisma.attributeClass.findMany({
      where: {
        environmentId: environmentId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    const transformedAttributeClasses: TAttributeClass[] = attributeClasses
      .map(transformPrismaAttributeClass)
      .filter((attributeClass): attributeClass is TAttributeClass => attributeClass !== null);

    return transformedAttributeClasses;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching attributeClasses for environment ${environmentId}`);
  }
});

export const updatetAttributeClass = async (
  attributeClassId: string,
  data: Partial<TAttributeClassUpdateInput>
): Promise<TAttributeClass | null> => {
  validateInputs([attributeClassId, ZId], [data, ZAttributeClassUpdateInput.partial()]);
  try {
    let attributeClass = await prisma.attributeClass.update({
      where: {
        id: attributeClassId,
      },
      data: {
        description: data.description,
        archived: data.archived,
      },
    });
    const transformedAttributeClass: TAttributeClass | null = transformPrismaAttributeClass(attributeClass);

    revalidateTag(attributeClassesCacheTag(attributeClass.environmentId));
    return transformedAttributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when updating attribute class with id ${attributeClassId}`);
  }
};

export const getAttributeClassByNameCached = async (environmentId: string, name: string) =>
  await unstable_cache(
    async () => {
      return await getAttributeClassByName(environmentId, name);
    },
    getAttributeClassesCacheKey(environmentId),
    {
      tags: getAttributeClassesCacheKey(environmentId),
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getAttributeClassByName = cache(
  async (environmentId: string, name: string): Promise<TAttributeClass | null> => {
    const attributeClass = await prisma.attributeClass.findFirst({
      where: {
        environmentId,
        name,
      },
    });
    return transformPrismaAttributeClass(attributeClass);
  }
);

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
  return transformPrismaAttributeClass(attributeClass);
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
