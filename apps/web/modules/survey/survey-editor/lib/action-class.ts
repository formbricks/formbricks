import { ActionClass, Prisma } from "@prisma/client";
import { cache as reactCache } from "react";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { actionClassCache } from "@formbricks/lib/actionClass/cache";
import { cache } from "@formbricks/lib/cache";
import { validateInputs } from "@formbricks/lib/utils/validate";
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new DatabaseError(
        `Action with ${error.meta?.target?.[0]} ${actionClass[error.meta?.target?.[0]]} already exists`
      );
    }

    throw new DatabaseError(`Database error when creating an action for environment ${environmentId}`);
  }
};

export const getActionClasses = reactCache(
  async (environmentId: string): Promise<ActionClass[]> =>
    cache(
      async () => {
        validateInputs([environmentId, z.string().cuid2()]);

        try {
          return await prisma.actionClass.findMany({
            where: {
              environmentId: environmentId,
            },
            orderBy: {
              createdAt: "asc",
            },
          });
        } catch (error) {
          throw new DatabaseError(`Database error when fetching actions for environment ${environmentId}`);
        }
      },
      [`survey-editor-getActionClasses-${environmentId}`],
      {
        tags: [actionClassCache.tag.byEnvironmentId(environmentId)],
      }
    )()
);
