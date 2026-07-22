import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TSurveyArchivePurgeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import {
  SURVEY_ARCHIVE_PURGE_BATCH_SIZE,
  SURVEY_ARCHIVE_RETENTION_DAYS,
} from "@/modules/survey/archive/lib/constants";
import { deleteSurvey } from "@/modules/survey/lib/surveys";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Surveys archived on or before this cutoff are past the retention window and can be purged. */
export const getSurveyArchivePurgeCutoff = (now: Date): Date =>
  new Date(now.getTime() - SURVEY_ARCHIVE_RETENTION_DAYS * MS_PER_DAY);

/**
 * Permanently deletes archived surveys whose retention window has elapsed. Runs on a daily cron.
 * Each survey is deleted independently so a single failure does not abort the batch, and each
 * deletion is recorded in the audit log with a system actor.
 */
export const purgeExpiredArchivedSurveys = async (now: Date = new Date()): Promise<number> => {
  const cutoff = getSurveyArchivePurgeCutoff(now);
  let purgedCount = 0;

  while (true) {
    const expiredSurveys = await prisma.survey.findMany({
      where: { archivedAt: { lt: cutoff } },
      orderBy: { archivedAt: "asc" },
      take: SURVEY_ARCHIVE_PURGE_BATCH_SIZE,
      select: {
        id: true,
        workspaceId: true,
        workspace: { select: { organizationId: true } },
      },
    });

    if (expiredSurveys.length === 0) {
      break;
    }

    const purgedBeforeBatch = purgedCount;

    for (const survey of expiredSurveys) {
      try {
        await deleteSurvey(survey.id);
        purgedCount += 1;

        await queueAuditEventWithoutRequest({
          action: "deleted",
          organizationId: survey.workspace.organizationId,
          status: "success",
          targetId: survey.id,
          targetType: "survey",
          userId: "system",
          userType: "system",
        }).catch((auditError) => {
          logger.error(
            { err: auditError, surveyId: survey.id, workspaceId: survey.workspaceId },
            "Survey archive purge audit log failed"
          );
        });
      } catch (error) {
        logger.error(
          { err: error, surveyId: survey.id, workspaceId: survey.workspaceId },
          "Failed to purge archived survey"
        );
      }
    }

    // A short final batch means we've reached the tail; stop looping.
    if (expiredSurveys.length < SURVEY_ARCHIVE_PURGE_BATCH_SIZE) {
      break;
    }

    // No progress on a full batch means every deletion failed and would repeat forever.
    // Stop and let the next scheduled run retry.
    if (purgedCount === purgedBeforeBatch) {
      logger.error(
        { cutoff: cutoff.toISOString() },
        "Survey archive purge made no progress on a full batch; aborting run"
      );
      break;
    }
  }

  return purgedCount;
};

export const processSurveyArchivePurgeJob: JobHandler<TSurveyArchivePurgeJobData> = async (data, context) => {
  const logContext = {
    attempt: context.attempt,
    jobId: context.jobId,
    jobName: context.jobName,
    maxAttempts: context.maxAttempts,
    queueName: context.queueName,
    scope: data.scope,
  };

  logger.info(logContext, "Survey archive purge job started");

  const purgedCount = await purgeExpiredArchivedSurveys(new Date());

  logger.info({ ...logContext, purgedCount }, "Survey archive purge job completed");
};
