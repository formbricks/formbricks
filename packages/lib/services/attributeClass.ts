"use server";
import "server-only";
import { prisma } from "@formbricks/database";
import {
  TAttributeClass,
  TAttributeClassType,
  TAttributeClassUpdateInput,
  ZAttributeClassUpdateInput,
} from "@formbricks/types/v1/attributeClasses";
import { ZId } from "@formbricks/types/v1/environment";
import { validateInputs } from "../utils/validate";
import { DatabaseError } from "@formbricks/types/v1/errors";
import { cache } from "react";
import { revalidateTag, unstable_cache } from "next/cache";

const attributeClassesCacheTag = (environmentId: string): string => `env-${environmentId}-attributeClasses`;

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
      revalidate: 30 * 60, // 30 minutes
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

export const getActiveSurveysForAttributeClass = cache(
  async (attributeClassId: string): Promise<string[]> => {
    const activeSurveysData = await prisma.surveyAttributeFilter.findMany({
      where: {
        attributeClassId,
        survey: {
          status: "inProgress",
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });

    const activeSurveys = activeSurveysData.map((t) => t.survey.name);
    return activeSurveys;
  }
);

export const getInactiveSurveysForAttributeClass = cache(
  async (attributeClassId: string): Promise<string[]> => {
    const inactiveSurveysData = await prisma.surveyAttributeFilter.findMany({
      where: {
        attributeClassId,
        survey: {
          status: {
            in: ["paused", "completed"],
          },
        },
      },
      select: {
        survey: {
          select: {
            name: true,
          },
        },
      },
    });
    const inactiveSurveys = inactiveSurveysData.map((t) => t.survey.name);
    return inactiveSurveys;
  }
);
