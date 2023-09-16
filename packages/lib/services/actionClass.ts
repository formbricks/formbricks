"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/v1/actionClasses";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import { validateInputs } from "../utils/validate";

const getActionClassesCacheTag = (environmentId: string): string => `env-${environmentId}-actionClasses`;
const getActionClassesCacheKey = (environmentId: string): string[] => [
  getActionClassesCacheTag(environmentId),
];

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

export const getActionClasses = cache(async (environmentId: string): Promise<TActionClass[]> => {
  validateInputs([environmentId, ZId]);
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
});

export const getActionClassesCached = (environmentId: string) =>
  unstable_cache(
    async () => {
      return await getActionClasses(environmentId);
    },
    getActionClassesCacheKey(environmentId),
    {
      tags: getActionClassesCacheKey(environmentId),
      revalidate: 30 * 60, // 30 minutes
    }
  )();

export const deleteActionClass = async (
  environmentId: string,
  actionClassId: string
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId]);
  try {
    const result = await prisma.eventClass.delete({
      where: {
        id: actionClassId,
      },
      select,
    });
    if (result === null) throw new ResourceNotFoundError("Action", actionClassId);

    // revalidate cache
    revalidateTag(getActionClassesCacheTag(environmentId));

    return result;
  } catch (error) {
    throw new DatabaseError(
      `Database error when deleting an action with id ${actionClassId} for environment ${environmentId}`
    );
  }
};

export const createActionClass = async (
  environmentId: string,
  actionClass: TActionClassInput
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClass, ZActionClassInput]);
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

    // revalidate cache
    revalidateTag(getActionClassesCacheTag(environmentId));

    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};

export const updateActionClass = async (
  environmentId: string,
  actionClassId: string,
  inputActionClass: Partial<TActionClassInput>
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId], [inputActionClass, ZActionClassInput.partial()]);
  try {
    const result = await prisma.eventClass.update({
      where: {
        id: actionClassId,
      },
      data: {
        name: inputActionClass.name,
        description: inputActionClass.description,
        type: inputActionClass.type,
        noCodeConfig: inputActionClass.noCodeConfig
          ? JSON.parse(JSON.stringify(inputActionClass.noCodeConfig))
          : undefined,
      },
      select,
    });

    // revalidate cache
    revalidateTag(getActionClassesCacheTag(environmentId));

    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when updating an action for environment ${environmentId}`);
  }
};
