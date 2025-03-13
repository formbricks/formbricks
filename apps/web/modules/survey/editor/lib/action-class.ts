import { ActionClass, Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { PrismaErrorType } from "@formbricks/database/src/types/error";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError } from "@formbricks/types/errors";

export const createActionClass = async (
  environmentId: string,
  actionClass: TActionClassInput
): Promise<ActionClass> => {
  const { environmentId: _, ...actionClassInput } = actionClass;

  try {
    const actionClassPrisma = await prisma.actionClass.create({
      data: {
        ...actionClassInput,
        environment: { connect: { id: environmentId } },
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig: actionClassInput.type === "noCode" ? actionClassInput.noCodeConfig || {} : undefined,
      },
    });

    actionClassCache.revalidate({
      name: actionClassPrisma.name,
      environmentId: actionClassPrisma.environmentId,
      id: actionClassPrisma.id,
    });

    return actionClassPrisma;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === PrismaErrorType.UniqueConstraintViolation
    ) {
      throw new DatabaseError(
        `Action with ${error.meta?.target?.[0]} ${actionClass[error.meta?.target?.[0]]} already exists`
      );
    }

    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};
