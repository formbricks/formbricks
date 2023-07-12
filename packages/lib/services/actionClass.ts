"use server";

import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/errors";
import { TActionClass } from "@formbricks/types/v1/actionClasses";
import "server-only";

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

export const createActionClassServerAction = async (environmentId: string, actionClass) => {
  try {
    const result = await prisma.eventClass.create({
      data: {
        ...actionClass,
        environment: { connect: { id: environmentId } },
      },
    });
    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};
