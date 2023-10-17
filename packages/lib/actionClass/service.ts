"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import { SERVICES_REVALIDATION_INTERVAL, ITEMS_PER_PAGE } from "../constants";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/v1/actionClasses";
import { ZId } from "@formbricks/types/v1/environment";
import { ZOptionalNumber } from "@formbricks/types/v1/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/v1/errors";
import { unstable_cache } from "next/cache";
import { validateInputs } from "../utils/validate";
import { actionClassCache } from "./cache";

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

export const getActionClasses = (environmentId: string, page?: number): Promise<TActionClass[]> =>
  unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        const actionClasses = await prisma.eventClass.findMany({
          where: {
            environmentId: environmentId,
          },
          select,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          orderBy: {
            createdAt: "asc",
          },
        });

        return actionClasses;
      } catch (error) {
        throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
      }
    },
    [`getActionClasses-${environmentId}-${page}`],
    {
      tags: [actionClassCache.tag.byEnvironmentId(environmentId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();

export const getActionClass = async (actionClassId: string): Promise<TActionClass | null> =>
  unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const actionClass = await prisma.eventClass.findUnique({
          where: {
            id: actionClassId,
          },
          select,
        });

        return actionClass;
      } catch (error) {
        throw new DatabaseError(`Database error when fetching action`);
      }
    },
    [`getActionClass-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
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

    actionClassCache.revalidate({
      environmentId,
      id: actionClassId,
    });

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

    actionClassCache.revalidate({
      environmentId: result.environmentId,
      id: result.id,
    });

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
    actionClassCache.revalidate({
      environmentId: result.environmentId,
      name: result.name,
      id: result.id,
    });

    return result;
  } catch (error) {
    throw new DatabaseError(`Database error when updating an action for environment ${environmentId}`);
  }
};
