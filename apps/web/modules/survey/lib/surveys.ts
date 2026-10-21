import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma, type SurveyStatus } from "@formbricks/database/prisma";
import { PrismaErrorType } from "@formbricks/database/types/error";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { validateInputs } from "@/lib/utils/validate";
import {
  SurveyLinkedCreativesError,
  type TLinkedCreative,
  findLinkedCreatives,
  unlinkSurveyCreatives,
} from "@/modules/creatives/lib/linked-creatives";
import { drainDeletionCleanups } from "@/modules/deletion-cleanup/lib/drain";
import { enqueueSurveyDeletionCleanups } from "@/modules/deletion-cleanup/lib/enqueue";
import { collectSurveyResponseFileUrls } from "@/modules/storage/lib/survey-response-files";
import { getSurveyPurgeEligibleWhere } from "@/modules/survey/archive/lib/purge-eligibility";
import { restartSurveyRetention } from "@/modules/survey/archive/lib/retention-restart";

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
 *
 * Creatives: while linked creatives open the survey, the delete is refused with
 * `SurveyLinkedCreativesError` (409), checked under the row lock, which a creative write linking the
 * survey also takes. Archived creatives don't hold it: they are unlinked in the same transaction. The
 * archive purge unlinks every creative instead of refusing, so a survey archived 30 days ago can't fail
 * the purge forever. What was unlinked goes to `onCreativesUnlinked` after commit, for the caller's audit.
 */
export const deleteSurvey = async (
  surveyId: string,
  options?: {
    purgeCutoff?: Date;
    /** Runs in the delete's transaction, after the survey is gone: a record that must commit with it. */
    inTransaction?: (tx: Prisma.TransactionClient) => Promise<void>;
    /** After commit, with the creatives the delete unlinked; never called when it unlinked none. */
    onCreativesUnlinked?: (
      creatives: TLinkedCreative[],
      context: { organizationId: string }
    ) => Promise<void>;
  }
) => {
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

    const { deletedSurvey, drainNowIds, unlinked } = await prisma.$transaction(async (tx) => {
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

      const survey = { surveyId, workspaceId: locked.workspaceId };
      if (!options?.purgeCutoff) {
        const linkedCreatives = await findLinkedCreatives(tx, survey);
        if (linkedCreatives.length > 0) {
          throw new SurveyLinkedCreativesError("delete", linkedCreatives);
        }
      }
      // The Destination foreign key is NO ACTION: every creative still pointing here must go
      // first, or the delete below fails.
      const unlinkedCreatives = await unlinkSurveyCreatives(tx, {
        ...survey,
        include: options?.purgeCutoff ? "all" : "archived",
      });

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

      await options?.inTransaction?.(tx);

      return {
        deletedSurvey,
        drainNowIds,
        unlinked: { creatives: unlinkedCreatives, organizationId: locked.organizationId },
      };
    });

    // The survey is already gone, so a failure here must not reach the caller, who would retry a delete
    // that happened: what isn't done now stays queued for the drain job.
    try {
      await drainDeletionCleanups({ ids: drainNowIds });
    } catch (error) {
      logger.error({ err: error, surveyId }, "Deferred a deleted survey's storage cleanup to the drain job");
    }

    // Same reason: the unlink committed with the delete, so a failed report is logged, never thrown.
    if (unlinked.creatives.length > 0 && options?.onCreativesUnlinked) {
      try {
        await options.onCreativesUnlinked(unlinked.creatives, { organizationId: unlinked.organizationId });
      } catch (error) {
        logger.error({ err: error, surveyId }, "Failed to report the creatives a survey delete unlinked");
      }
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

/**
 * Restore an archived survey by clearing archivedAt. The survey keeps its current status. Restoring one
 * the surveys policy archived gives it a full data retention period again (`restartSurveyRetention`), in the same
 * transaction, with the survey locked; `retentionExemptionId` is the exemption that made, if any.
 * Restoring a survey that isn't archived writes nothing, so it doesn't count as a change to it either.
 */
export const restoreSurvey = async (surveyId: string, options?: { restoredById?: string | null }) => {
  validateInputs([surveyId, ZId]);

  try {
    return await prisma.$transaction(async (tx) => {
      const [locked] = await tx.$queryRaw<
        { status: SurveyStatus; archivedAt: Date | null; organizationId: string }[]
      >`
        SELECT s."status", s."archivedAt", w."organizationId"
        FROM "Survey" s
        JOIN "Workspace" w ON w."id" = s."workspaceId"
        WHERE s."id" = ${surveyId}
        FOR UPDATE OF s
      `;
      if (!locked) {
        throw new ResourceNotFoundError("Survey", surveyId);
      }
      if (!locked.archivedAt) {
        // Nothing to restore: no write, which would bump updated_at (a "no changes" clock) for nothing.
        return { id: surveyId, status: locked.status, archivedAt: null, retentionExemptionId: null };
      }
      const survey = await tx.survey.update({
        where: { id: surveyId },
        data: { archivedAt: null },
        select: { id: true, status: true, archivedAt: true },
      });
      const { exemptionId } = await restartSurveyRetention(tx, {
        surveyId,
        organizationId: locked.organizationId,
        restoredById: options?.restoredById ?? null,
      });
      return { ...survey, retentionExemptionId: exemptionId };
    });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      logger.warn({ surveyId }, "Survey not found during restore");
      throw error;
    }

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
