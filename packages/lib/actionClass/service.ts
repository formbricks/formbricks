"use server";
import "server-only";

import { prisma } from "@formbricks/database";
import {
  TActionClass,
  TActionClassInput,
  ZActionClass,
  ZActionClassInput,
} from "@formbricks/types/actionClasses";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { ITEMS_PER_PAGE, SERVICES_REVALIDATION_INTERVAL } from "../constants";
import { validateInputs } from "../utils/validate";
import { actionClassCache } from "./cache";
import { formatDateFields } from "../utils/datetime";

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

export const getActionClasses = async (environmentId: string, page?: number): Promise<TActionClass[]> => {
  const actionClasses = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        const actionClasses = await prisma.actionClass.findMany({
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
        return actionClasses.map((actionClass) => formatDateFields(actionClass, ZActionClass));
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
  return actionClasses.map((actionClass) => formatDateFields(actionClass, ZActionClass));
};

export const getActionClassByEnvironmentIdAndName = async (
  environmentId: string,
  name: string
): Promise<TActionClass | null> => {
  const actionClass = await unstable_cache(
    async () => {
      validateInputs([environmentId, ZId], [name, ZString]);

      try {
        const actionClass = await prisma.actionClass.findFirst({
          where: {
            name,
            environmentId,
          },
          select,
        });

        return actionClass;
      } catch (error) {
        throw new DatabaseError(`Database error when fetching action`);
      }
    },
    [`getActionClass-${environmentId}-${name}`],
    {
      tags: [actionClassCache.tag.byNameAndEnvironmentId(environmentId, name)],
      revalidate: SERVICES_REVALIDATION_INTERVAL,
    }
  )();
  return actionClass ? formatDateFields(actionClass, ZActionClass) : null;
};

export const getActionClass = async (actionClassId: string): Promise<TActionClass | null> => {
  const actionClass = await unstable_cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const actionClass = await prisma.actionClass.findUnique({
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
  return actionClass ? formatDateFields(actionClass, ZActionClass) : null;
};

export const deleteActionClass = async (
  environmentId: string,
  actionClassId: string
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId]);

  try {
    const result = await prisma.actionClass.delete({
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
    const actionClassPrisma = await prisma.actionClass.create({
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
      name: actionClassPrisma.name,
      environmentId: actionClassPrisma.environmentId,
      id: actionClassPrisma.id,
    });

    return actionClassPrisma;
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
    const result = await prisma.actionClass.update({
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
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
