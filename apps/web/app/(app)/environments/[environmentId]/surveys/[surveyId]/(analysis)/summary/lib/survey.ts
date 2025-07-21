import "server-only";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { prisma } from "@formbricks/database";
import { ZId } from "@formbricks/types/common";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteResponsesAndDisplaysForSurvey = async (
  surveyId: string
): Promise<{ deletedResponsesCount: number; deletedDisplaysCount: number }> => {
  validateInputs([surveyId, ZId]);

  try {
    // Delete all responses for this survey
    const deletedResponsesCount = await prisma.response.deleteMany({
      where: {
        surveyId: surveyId,
      },
    });

    // Delete all displays for this survey
    const deletedDisplaysCount = await prisma.display.deleteMany({
      where: {
        surveyId: surveyId,
      },
    });

    return {
      deletedResponsesCount: deletedResponsesCount.count,
      deletedDisplaysCount: deletedDisplaysCount.count,
    };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
