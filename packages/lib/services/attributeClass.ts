"use server";
import "server-only";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TAttributeClass, TAttributeClassInput } from "@formbricks/types/v1/attributeClasses";

export const transformPrismaAttributeClass = (attributeClass): TAttributeClass | null => {
  if (attributeClass === null) {
    return null;
  }

  const transformedAttributeClass: TAttributeClass = {
    ...attributeClass,
  };

  return transformedAttributeClass;
};

export const getAttributeClasses = async (environmentId: string): Promise<TAttributeClass[]> => {
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
};

export const getAttributeClass = async (attributeClassId: string): Promise<TAttributeClass | null> => {
  try {
    let attributeClass = await prisma.attributeClass.findUnique({
      where: {
        id: attributeClassId,
      },
    });

    return attributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching attributeClass with id ${attributeClassId}`);
  }
};

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

export const createAttributeClass = async (
  environmentId: string,
  attributeClass: TAttributeClassInput
): Promise<TAttributeClass> => {
  try {
    const result = await prisma.attributeClass.create({
      data: {
        name: attributeClass.name,
        description: attributeClass.description,
        type: attributeClass.type,
        archived: attributeClass.archived,
        environment: { connect: { id: environmentId } },
      },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when creating an attribute for environment ${environmentId}`);
  }
};

export const deleteAttributeClass = async (id: string): Promise<TAttributeClass> => {
  try {
    const deletedAttributeClass = await prisma.attributeClass.delete({
      where: {
        id,
      },
    });

    return deletedAttributeClass;
  } catch (error) {
    throw new DatabaseError(`Database error when deleting webhook with ID ${id}`);
  }
};
