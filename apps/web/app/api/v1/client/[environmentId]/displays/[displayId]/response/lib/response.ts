import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const getResponseIdByDisplayId = async (
  environmentId: string,
  displayId: string
): Promise<{ responseId: string | null }> => {
  validateInputs([environmentId, ZId], [displayId, ZId]);

  try {
    const display = await prisma.display.findFirst({
      where: {
        id: displayId,
        survey: {
          environmentId,
        },
      },
      select: {
        response: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!display) {
      throw new ResourceNotFoundError("Display", displayId);
    }

    return {
      responseId: display.response?.id ?? null,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
