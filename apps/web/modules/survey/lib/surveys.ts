import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import { drainDeletionCleanups } from "@/modules/deletion-cleanup/lib/drain";
import { enqueueSurveyDeletionCleanups } from "@/modules/deletion-cleanup/lib/enqueue";
import { collectSurveyResponseFileUrls } from "@/modules/storage/lib/survey-response-files";
import { getSurveyPurgeEligibleWhere } from "@/modules/survey/archive/lib/purge-eligibility";

/**
 * Permanently deletes a survey, cascades private-segment cleanup, and removes what it leaves outside the
 * database: its respondents' uploads and its Hub records.
 *
 * `options.purgeCutoff` is the archive purge's guard: the survey must still be eligible at that cutoff
 * (archived before it, not held by a retention exemption; `getSurveyPurgeEligibleWhere`). It is checked
 * once before the file scan, so a held survey costs no scan, and again with the row locked FOR UPDATE in
 * the delete's transaction, so a restore or an exemption that lands in between wins: an exemption's
 * foreign key takes FOR KEY SHARE on the survey, so it waits for this lock and then fails, or this delete
 * waits for it and then skips. When the guard fails the survey is treated as gone (ResourceNotFoundError),
 * never deleted, and nothing is queued.
 *
 * The cleanup is queued in the same transaction (`enqueueSurveyDeletionCleanups`): a delete that commits
 * always gets it, retried until done, and one that rolls back touches no file and no Hub record. The
 * storage part is drained straight after commit; the Hub part a few minutes later, once any record still
 * on its way has landed.
 */
export const deleteSurvey = async (surveyId: string, options?: { purgeCutoff?: Date }) => {
  validateInputs([surveyId, ZId]);
  const eligibleWhere = options?.purgeCutoff ? getSurveyPurgeEligibleWhere(options.purgeCutoff) : null;
  const isStillEligible = async (client: Pick<Prisma.TransactionClient, "survey">) =>
    !eligibleWhere ||
    (await client.survey.findFirst({ where: { id: surveyId, ...eligibleWhere }, select: { id: true } })) !==
      null;

  try {
    if (!(await isStillEligible(prisma))) {
      throw new ResourceNotFoundError("Survey", surveyId);
    }

    // The responses go by FK cascade, taking the upload URLs in `response.data` with them, so read those
    // first. Outside the transaction on purpose: a large scan must not hold the row lock the guard
    // takes, or run into the interactive-transaction timeout. Flat keys only: the folder delete takes
    // every key filed under the survey, including ones the scan can't see (removed upload elements,
    // uploads never submitted, a response that landed after the scan); a key filed under another survey
    // is never ours to delete.
    const { fileUrls } = await collectSurveyResponseFileUrls(surveyId, { flatKeysOnly: true });

    const { deletedSurvey, drainNowIds } = await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<{ workspaceId: string; organizationId: string }[]>`
        SELECT s."workspaceId", w."organizationId"
        FROM "Survey" s
        JOIN "Workspace" w ON w."id" = s."workspaceId"
        WHERE s."id" = ${surveyId}
        FOR UPDATE OF s
      `;
      if (!locked || !(await isStillEligible(tx))) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }

      const { drainNowIds } = await enqueueSurveyDeletionCleanups(tx, {
        organizationId: locked.organizationId,
        workspaceId: locked.workspaceId,
        surveyId,
        fileUrls,
      });

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

      return { deletedSurvey, drainNowIds };
    });

    // The survey is already gone, so a failure here must not reach the caller, who would retry a delete
    // that happened: what isn't done now stays queued for the drain job.
    try {
      await drainDeletionCleanups({ ids: drainNowIds });
    } catch (error) {
      logger.error({ error, surveyId }, "Deferred a deleted survey's storage cleanup to the drain job");
    }

    return deletedSurvey;
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
 * - Sets archivedAt to now. publishOn is preserved so restore returns the survey unchanged: the
 *   scheduling job already excludes archived surveys (archivedAt: null) from its publish/close scan,
 *   so an archived survey can't auto-publish regardless — clearing publishOn would only destroy a
 *   scheduled launch date that restore is supposed to hand back.
 * - If the survey was inProgress, moves it to paused so response/display intake stops immediately.
 * - Idempotent: archiving an already-archived survey is a no-op.
 * - `options.tx` runs it inside the caller's transaction, for a caller that has locked and re-checked the
 *   survey there first (the data retention sweep).
 */
export const archiveSurvey = async (surveyId: string, options?: { tx?: Prisma.TransactionClient }) => {
  validateInputs([surveyId, ZId]);

  const archive = async (tx: Prisma.TransactionClient) => {
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
        ...(survey.status === "inProgress" ? { status: "paused" } : {}),
      },
      select: { id: true, status: true, archivedAt: true },
    });
  };

  try {
    return options?.tx ? await archive(options.tx) : await prisma.$transaction(archive);
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
