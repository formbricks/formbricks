"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TActionClass, TActionClassInput } from "@formbricks/types/v1/actionClasses";

const select = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  description: true,
  type: true,
  noCodeConfig: true,
  environmentId: true,
};

export const getActionClasses = async (environmentId: string): Promise<TActionClass[]> => {
  try {
    let actionClasses = await prisma.eventClass.findMany({
      where: {
        environmentId: environmentId,
      },
      select,
      orderBy: {
        createdAt: "asc",
      },
    });

    return actionClasses;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
  }
};

export const createActionClass = async (
  environmentId: string,
  actionClass: TActionClassInput
): Promise<TActionClass> => {
  try {
    const result = await prisma.eventClass.create({
      data: {
        name: actionClass.name,
        description: actionClass.description,
        type: actionClass.type,
        noCodeConfig: actionClass.noCodeConfig
          ? JSON.parse(JSON.stringify(actionClass.noCodeConfig))
          : undefined,
        environment: { connect: { id: environmentId } },
      },
      select,
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};
