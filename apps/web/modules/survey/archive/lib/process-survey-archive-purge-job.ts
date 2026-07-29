import "server-only";
import { prisma } from "@formbricks/database";
import type { JobHandler, TSurveyArchivePurgeJobData } from "@formbricks/jobs";
import { logger } from "@formbricks/logger";
import { ResourceNotFoundError } from "@formbricks/types/errors";
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
// Upper bound on batches per run. Progress is normally guaranteed (each batch either purges rows or
// excludes failed ones), so this is a defensive backstop against an unforeseen non-terminating state,
// not the expected exit. At 100/batch this covers 1M eligible surveys before deferring to the next run.
const MAX_PURGE_BATCHES = 10_000;

type TExpiredSurvey = {
  id: string;
  workspaceId: string;
  workspace: { organizationId: string };
};

type TPurgeOutcome = "purged" | "skipped" | "failed";

/**
 * Permanently delete one archived survey and record the audit event. Returns the outcome so the
 * caller can count purges and isolate failures without unwinding the batch:
 * - "purged":  the survey was deleted (audit failures are logged, not fatal — the row is already gone)
 * - "skipped": the survey was restored or already gone (no longer eligible, will not reappear)
 * - "failed":  a real deletion error; the caller excludes it from later batches this run
 */
const purgeArchivedSurvey = async (survey: TExpiredSurvey, cutoff: Date): Promise<TPurgeOutcome> => {
  try {
    // Guarded delete: the survey is re-checked (locked) inside deleteSurvey's transaction so a
    // survey restored after this batch was selected is skipped, not permanently deleted.
    await deleteSurvey(survey.id, { requireArchivedBefore: cutoff });
  } catch (error) {
    // Restored or already gone between selection and delete — no longer eligible, won't reappear.
    if (error instanceof ResourceNotFoundError) {
      return "skipped";
    }

    logger.error(
      { err: error, surveyId: survey.id, workspaceId: survey.workspaceId },
      "Failed to purge archived survey"
    );
    return "failed";
  }

  // Await the audit enqueue so a hard delete is not left without an audit record if the process exits
  // before a fire-and-forget promise flushes. A failed enqueue is logged, not fatal.
  try {
    await queueAuditEventWithoutRequest({
      action: "deleted",
      organizationId: survey.workspace.organizationId,
      status: "success",
      targetId: survey.id,
      targetType: "survey",
      userId: "system",
      userType: "system",
    });
  } catch (auditError) {
    logger.error(
      { err: auditError, surveyId: survey.id, workspaceId: survey.workspaceId },
      "Survey archive purge audit log failed"
    );
  }

  return "purged";
};

export const purgeExpiredArchivedSurveys = async (now: Date = new Date()): Promise<number> => {
  const cutoff = getSurveyArchivePurgeCutoff(now);
  let purgedCount = 0;
  let batches = 0;
  // Surveys that threw a non-recoverable error this run. Excluded from subsequent batches so a single
  // poison-pill row cannot be re-selected forever (it sorts to the head of every archivedAt-asc page).
  const failedSurveyIds = new Set<string>();

  while (batches < MAX_PURGE_BATCHES) {
    batches += 1;
    const expiredSurveys = await prisma.survey.findMany({
      where: {
        archivedAt: { lt: cutoff },
        ...(failedSurveyIds.size > 0 ? { id: { notIn: Array.from(failedSurveyIds) } } : {}),
      },
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

    for (const survey of expiredSurveys) {
      const outcome = await purgeArchivedSurvey(survey, cutoff);
      if (outcome === "purged") {
        purgedCount += 1;
      } else if (outcome === "failed") {
        failedSurveyIds.add(survey.id);
      }
    }

    // A short batch means every remaining eligible survey has been attempted; stop looping.
    if (expiredSurveys.length < SURVEY_ARCHIVE_PURGE_BATCH_SIZE) {
      break;
    }
  }

  if (batches >= MAX_PURGE_BATCHES) {
    logger.warn(
      { cutoff: cutoff.toISOString(), purgedCount, batches },
      "Survey archive purge hit the batch cap; remaining surveys defer to the next scheduled run"
    );
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
