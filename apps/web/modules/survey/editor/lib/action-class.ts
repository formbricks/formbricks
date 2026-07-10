import { prisma } from "@formbricks/database";
import { isUniqueConstraintError } from "@formbricks/database/errors";
import { ActionClass } from "@formbricks/database/prisma";
import { TActionClassInput } from "@formbricks/types/action-classes";
import { DatabaseError, UniqueConstraintError } from "@formbricks/types/errors";

export const createActionClass = async (
  workspaceId: string,
  actionClass: TActionClassInput
): Promise<ActionClass> => {
  const { workspaceId: _, ...actionClassInput } = actionClass;

  try {
    const actionClassPrisma = await prisma.actionClass.create({
      data: {
        ...actionClassInput,
        workspace: { connect: { id: workspaceId } },
        key: actionClassInput.type === "code" ? actionClassInput.key : undefined,
        noCodeConfig:
          actionClassInput.type === "noCode"
            ? actionClassInput.noCodeConfig === null
              ? undefined
              : actionClassInput.noCodeConfig
            : undefined,
      },
    });

    return actionClassPrisma;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const targetField = (error.meta?.target as string[] | undefined)?.[0];
      throw new UniqueConstraintError(
        `Action with ${targetField} ${targetField ? (actionClass as Record<string, unknown>)[targetField] : ""} already exists`
      );
    }

    throw new DatabaseError(`Database error when creating an action for workspace ${workspaceId}`);
  }
};
