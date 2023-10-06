"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/v1/actionClasses";
import { ZId } from "@formbricks/types/v1/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { revalidateTag, unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";

export const getActionClassCacheTag = (name: string, environmentId: string): string =>
  `environments-${environmentId}-actionClass-${name}`;

const getActionClassesCacheTag = (environmentId: string): string =>
  `environments-${environmentId}-actionClasses`;

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

export const getActionClasses = (environmentId: string): Promise<TActionClass[]> =>
  unstable_cache(
    async () => {
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
    },
    [`environments-${environmentId}-actionClasses`],
    {
      tags: [getActionClassesCacheTag(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionClass = async (actionClassId: string): Promise<TActionClass | null> => {
  validateInputs([actionClassId, ZId]);
  try {
    let actionClass = await prisma.eventClass.findUnique({
      where: {
        id: actionClassId,
      },
      select,
    });

    return actionClass;
  } catch (error) {
    throw new DatabaseError(`Database error when fetching action`);
  }
};

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
    revalidateTag(getActionClassesCacheTag(result.environmentId));

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
    revalidateTag(getActionClassCacheTag(result.name, result.environmentId));
    revalidateTag(getActionClassesCacheTag(result.environmentId));

    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when updating an action for environment ${environmentId}`);
  }
};

export const getActionClassCached = async (name: string, environmentId: string) =>
  unstable_cache(
    async () => {
      return await prisma.eventClass.findFirst({
        where: {
          name,
          environmentId,
        },
      });
    },
    [`environments-${environmentId}-actionClasses-${name}`],
    {
      tags: [getActionClassesCacheTag(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
