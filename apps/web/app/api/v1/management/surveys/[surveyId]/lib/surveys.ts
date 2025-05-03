import { segmentCache } from "@/lib/cache/segment";
import { responseCache } from "@/lib/response/cache";
import { surveyCache } from "@/lib/survey/cache";
import { validateInputs } from "@/lib/utils/validate";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { DatabaseError } from "@formbricks/types/errors";

export const deleteSurvey = async (surveyId: string) => {
  // [UseTusk]
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
      const deletedSegment = await prisma.segment.delete({
        where: {
          id: deletedSurvey.segment.id,
        },
      });

      if (deletedSegment) {
        segmentCache.revalidate({
          id: deletedSegment.id,
          environmentId: deletedSurvey.environmentId,
        });
      }
    }

    responseCache.revalidate({
      surveyId,
      environmentId: deletedSurvey.environmentId,
    });
    surveyCache.revalidate({
      id: deletedSurvey.id,
      environmentId: deletedSurvey.environmentId,
      resultShareKey: deletedSurvey.resultShareKey ?? undefined,
    });

    if (deletedSurvey.segment?.id) {
      segmentCache.revalidate({
        id: deletedSurvey.segment.id,
        environmentId: deletedSurvey.environmentId,
      });
    }

    // Revalidate public triggers by actionClassId
    deletedSurvey.triggers.forEach((trigger) => {
      surveyCache.revalidate({
        actionClassId: trigger.actionClass.id,
      });
    });

    return deletedSurvey;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ error, surveyId }, "Error deleting survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
