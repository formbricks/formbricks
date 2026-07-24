import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";

/**
 * Permanently deletes a survey and cascades private-segment cleanup.
 *
 * `options.requireArchivedBefore` guards the purge cron against a restore-vs-purge race: the survey
 * row is locked FOR UPDATE and its `archivedAt` re-checked inside the same transaction as the delete,
 * so a survey restored (archivedAt cleared) after the purge batch was selected is skipped rather than
 * hard-deleted. When the guard fails the row is treated as gone (ResourceNotFoundError), never deleted.
 */
export const deleteSurvey = async (surveyId: string, options?: { requireArchivedBefore?: Date }) => {
  validateInputs([surveyId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      if (options?.requireArchivedBefore) {
        // Lock the row so a concurrent restore blocks until this transaction resolves, then re-read
        // the current archivedAt. If the survey was restored (or moved out of the retention window),
        // skip the delete entirely — do not permanently delete a survey that is no longer eligible.
        await tx.$queryRaw`SELECT id FROM "Survey" WHERE id = ${surveyId} FOR UPDATE`;
        const guard = await tx.survey.findUnique({
          where: { id: surveyId },
          select: { archivedAt: true },
        });
        if (!guard?.archivedAt || guard.archivedAt >= options.requireArchivedBefore) {
          throw new ResourceNotFoundError("Survey", surveyId);
        }
      }

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
      if (error.code === PrismaErrorType.RecordNotFound) {
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
      // Match restoreSurvey's contract: a row deleted mid-transaction (P2025) is "not found", not a 500.
      if (error.code === "P2025") {
        logger.warn({ surveyId }, "Survey not found during archive");
        throw new ResourceNotFoundError("Survey", surveyId);
      }

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
