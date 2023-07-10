"use server";

import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TAction } from "@formbricks/types/v1/actions";

export const transformPrismaActionClass = (actionClass): TAction | null => {
  if (actionClass === null) {
    return null;
  }

  const transformedActionClass: TAction = {
    id: actionClass.id,
    name: actionClass.name,
    description: actionClass.description,
    type: actionClass.type,
    noCodeConfig: actionClass.noCodeConfig,
    environmentId: actionClass.environmentId,
    actionCount: actionClass._count.events,
    createdAt: actionClass.createdAt,
    updatedAt: actionClass.updatedAt,
  };

  return transformedActionClass;
};

export const getActionClasses = async (environmentId: string): Promise<TAction[]> => {
  try {
    let actionClasses = await prisma.eventClass.findMany({
      where: {
        environmentId: environmentId,
      },
      orderBy: {
        createdAt: "asc",
      },
      include: {
        _count: {
          select: {
            events: true,
          },
        },
      },
    });

    const transformedActionClasses: TAction[] = actionClasses
      .map(transformPrismaActionClass)
      .filter((actionClass): actionClass is TAction => actionClass !== null);

    return transformedActionClasses;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
  }
};

export const createActionClassServerAction = async (environmentId: string, eventClass) => {
  try {
    const result = await prisma.eventClass.create({
      data: {
        ...eventClass,
        environment: { connect: { id: environmentId } },
      },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};
