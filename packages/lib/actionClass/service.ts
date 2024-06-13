"use server";

import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { TActionClass, TActionClassInput, ZActionClassInput } from "@formbricks/types/actionClasses";
import { ZOptionalNumber, ZString } from "@formbricks/types/common";
import { ZId } from "@formbricks/types/environment";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { cache } from "../cache";
import { ITEMS_PER_PAGE } from "../constants";
import { validateInputs } from "../utils/validate";
import { actionClassCache } from "./cache";

const selectActionClass = {
  id: true,
  createdAt: true,
  updatedAt: true,
  name: true,
  description: true,
  type: true,
  key: true,
  noCodeConfig: true,
  environmentId: true,
} satisfies Prisma.ActionClassSelect;

export const getActionClasses = (environmentId: string, page?: number): Promise<TActionClass[]> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [page, ZOptionalNumber]);

      try {
        return await prisma.actionClass.findMany({
          where: {
            environmentId: environmentId,
          },
          select: selectActionClass,
          take: page ? ITEMS_PER_PAGE : undefined,
          skip: page ? ITEMS_PER_PAGE * (page - 1) : undefined,
          orderBy: {
            createdAt: "asc",
          },
        });
      } catch (error) {
        throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
      }
    },
    [`getActionClasses-${environmentId}-${page}`],
    {
      tags: [actionClassCache.tag.byEnvironmentId(environmentId)],
    }
  )();

// This function is used to get an action by its name and environmentId(it can return private actions as well)
export const getActionClassByEnvironmentIdAndName = (
  environmentId: string,
  name: string
): Promise<TActionClass | null> =>
  cache(
    async () => {
      validateInputs([environmentId, ZId], [name, ZString]);

      try {
        const actionClass = await prisma.actionClass.findFirst({
          where: {
            name,
            environmentId,
          },
          select: selectActionClass,
        });

        return actionClass;
      } catch (error) {
        throw new DatabaseError(`Database error when fetching action`);
      }
    },
    [`getActionClassByEnvironmentIdAndName-${environmentId}-${name}`],
    {
      tags: [actionClassCache.tag.byNameAndEnvironmentId(name, environmentId)],
    }
  )();

export const getActionClass = (actionClassId: string): Promise<TActionClass | null> =>
  cache(
    async () => {
      validateInputs([actionClassId, ZId]);

      try {
        const actionClass = await prisma.actionClass.findUnique({
          where: {
            id: actionClassId,
          },
          select: selectActionClass,
        });

        return actionClass;
      } catch (error) {
        throw new DatabaseError(`Database error when fetching action`);
      }
    },
    [`getActionClass-${actionClassId}`],
    {
      tags: [actionClassCache.tag.byId(actionClassId)],
    }
  )();

export const deleteActionClass = async (
  environmentId: string,
  actionClassId: string
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId]);

  try {
    const actionClass = await prisma.actionClass.delete({
      where: {
        id: actionClassId,
      },
      select: selectActionClass,
    });
    if (actionClass === null) throw new ResourceNotFoundError("Action", actionClassId);

    actionClassCache.revalidate({
      environmentId,
      id: actionClassId,
      name: actionClass.name,
    });

    return actionClass;
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

  const { environmentId: _, ...actionClassInput } = actionClass;

  try {
    const actionClassPrisma = await prisma.actionClass.create({
      data: {
        ...actionClassInput,
        environment: { connect: { id: environmentId } },
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig: actionClassInput.type === "noCode" ? actionClassInput.noCodeConfig || {} : undefined,
      },
      select: selectActionClass,
    });

    actionClassCache.revalidate({
      name: actionClassPrisma.name,
      environmentId: actionClassPrisma.environmentId,
      id: actionClassPrisma.id,
    });

    return actionClassPrisma;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DatabaseError(
        `Action with ${error.meta?.target?.[0]} ${actionClass[error.meta?.target?.[0]]} already exists`
      );
    }

    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};

export const updateActionClass = async (
  environmentId: string,
  actionClassId: string,
  inputActionClass: Partial<TActionClassInput>
): Promise<TActionClass> => {
  validateInputs([environmentId, ZId], [actionClassId, ZId], [inputActionClass, ZActionClassInput]);

  const { environmentId: _, ...actionClassInput } = inputActionClass;
  try {
    const result = await prisma.actionClass.update({
      where: {
        id: actionClassId,
      },
      data: {
        ...actionClassInput,
        environment: { connect: { id: environmentId } },
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig: actionClassInput.type === "noCode" ? actionClassInput.noCodeConfig || {} : undefined,
      },
      select: selectActionClass,
    });

    // revalidate cache
    actionClassCache.revalidate({
      environmentId: result.environmentId,
      name: result.name,
      id: result.id,
    });

    return result;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DatabaseError(
        `Action with ${error.meta?.target?.[0]} ${inputActionClass[error.meta?.target?.[0]]} already exists`
      );
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }
    throw error;
  }
};
