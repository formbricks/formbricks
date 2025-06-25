import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteSurvey = async (surveyId: string) => {
  validateInputs([surveyId, z.string().cuid2()]);

  try {
    const deletedSurvey = await prisma.survey.delete({
      where: {
        id: surveyId,
      },
      include: {
        segment: true,
        triggers: {
          include: {
            actionClass: true,
          },
        },
      },
    });

    if (deletedSurvey.type === "app" && deletedSurvey.segment?.isPrivate) {
      await prisma.segment.delete({
        where: {
          id: deletedSurvey.segment.id,
        },
      });
    }

    return deletedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ error, surveyId }, "Error deleting survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
