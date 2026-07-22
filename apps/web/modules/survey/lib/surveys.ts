import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

export const deleteSurvey = async (surveyId: string) => {
  validateInputs([surveyId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const deletedSurvey = await tx.survey.delete({
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
        await tx.segment.delete({
          where: {
            id: deletedSurvey.segment.id,
          },
        });
      }

      return deletedSurvey;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        logger.warn({ surveyId }, "Survey not found during delete");
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      logger.error({ error, surveyId }, "Error deleting survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/**
 * Soft-delete (archive) a survey. Archived surveys are hidden from the default list, stop
 * collecting responses, and are permanently deleted by the purge job after the retention window.
 * - Sets archivedAt to now and clears publishOn (so the scheduling job never auto-publishes it).
 * - If the survey was inProgress, moves it to paused so response/display intake stops immediately.
 * - Idempotent: archiving an already-archived survey is a no-op.
 */
export const archiveSurvey = async (surveyId: string) => {
  validateInputs([surveyId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const survey = await tx.survey.findUnique({
        where: { id: surveyId },
        select: { id: true, status: true, archivedAt: true },
      });

      if (!survey) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      if (survey.archivedAt) {
        return survey;
      }

      return await tx.survey.update({
        where: { id: surveyId },
        data: {
          archivedAt: new Date(),
          publishOn: null,
          ...(survey.status === "inProgress" ? { status: "paused" } : {}),
        },
        select: { id: true, status: true, archivedAt: true },
      });
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      throw error;
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      logger.error({ error, surveyId }, "Error archiving survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};

/** Restore an archived survey by clearing archivedAt. The survey keeps its current status. */
export const restoreSurvey = async (surveyId: string) => {
  validateInputs([surveyId, ZId]);

  try {
    return await prisma.survey.update({
      where: { id: surveyId },
      data: { archivedAt: null },
      select: { id: true, status: true, archivedAt: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        logger.warn({ surveyId }, "Survey not found during restore");
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      logger.error({ error, surveyId }, "Error restoring survey");
      throw new DatabaseError(error.message);
    }

    throw error;
  }
};
