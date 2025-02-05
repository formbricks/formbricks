import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { displayCache } from "@formbricks/lib/display/cache";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteDisplay = async (displayId: string): Promise<boolean> => {
  try {
    const display = await prisma.display.delete({
      where: {
        id: displayId,
      },
      select: {
        id: true,
        contactId: true,
        surveyId: true,
      },
    });

    displayCache.revalidate({
      id: display.id,
      contactId: display.contactId,
      surveyId: display.surveyId,
    });

    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
