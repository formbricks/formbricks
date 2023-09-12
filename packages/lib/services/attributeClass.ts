"use server";
import "server-only";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { TAttributeClass } from "@formbricks/types/v1/attributeClasses";
import { cache } from "react";

export const transformPrismaAttributeClass = (attributeClass: any): TAttributeClass | null => {
  if (attributeClass === null) {
    return null;
  }

  const transformedAttributeClass: TAttributeClass = {
    ...attributeClass,
  };

  return transformedAttributeClass;
};

export const getAttributeClasses = cache(async (environmentId: string): Promise<TAttributeClass[]> => {
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
  data: { description?: string; archived?: boolean }
): Promise<TAttributeClass | null> => {
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

    return transformedAttributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when updating attribute class with id ${attributeClassId}`);
  }
};

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
