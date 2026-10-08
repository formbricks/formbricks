import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { getReportingTimeZone } from "@/lib/date-ranges";
import { deleteResponsesInTransaction } from "@/lib/response/delete-responses";
import { drainDeletionCleanups } from "@/modules/deletion-cleanup/lib/drain";
import { enqueueResponsesDeletionCleanups } from "@/modules/deletion-cleanup/lib/enqueue";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { UNKNOWN_DATA } from "@/modules/ee/audit-logs/types/audit-log";
import {
  type TRetentionTargetState,
  addRetentionDays,
  getDueRetentionStep,
  getRetentionClockCutoffs,
  getRetentionSchedule,
} from "../lib/schedule";
import {
  SURVEY_RETENTION_DUE_COUNT_CAP,
  countSurveyResponsesCreatedAtOrBefore,
} from "../lib/survey-retention-service";
import { RETENTION_SWEEP_BATCH_SIZE } from "./constants";
import { deleteRetentionNotice } from "./notices";
import { type TSurveyReadCheck, resolveSurveyNoticeRecipients } from "./recipients";
import { recordRetentionRunDeletion, recordRetentionRunSkips } from "./run";
import { type TNoticeOrganization, type TSurveyNoticeItem, sendSurveyNotices } from "./survey-notices";
import type { TRetentionSweepContext, TRetentionSweeper } from "./sweep";
import { lockUnchangedRetentionPolicy, runSweepTransaction } from "./transaction";

/** A survey with responses in the warning window, and what its schedule reads. */
type TResponsesCandidate = {
  id: string;
  name: string;
  workspaceId: string;
  ownerId: string | null;
  createdBy: string | null;
  oldestResponseAt: Date;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
  heldUntil: Date | null;
};

const targetState = (candidate: TResponsesCandidate): TRetentionTargetState => ({
  clock: candidate.oldestResponseAt,
  noticeClaimedAt: candidate.noticeClaimedAt,
  noticeDeliveredAt: candidate.noticeDeliveredAt,
  heldUntil: candidate.heldUntil,
  archivedAt: null,
});

/**
 * The organisation's surveys with a response in the warning window and no active responses exemption,
 * with their schedule facts, keyset-paged on the survey id. `surveyId` narrows it to one survey, for the
 * re-check under its lock. The oldest response is one index probe on `Response(surveyId, created_at)`.
 */
const readCandidates = (
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  context: TRetentionSweepContext,
  {
    afterId,
    surveyId,
    noticeDueAtOrBefore,
  }: { afterId?: string; surveyId?: string; noticeDueAtOrBefore: Date }
): Promise<TResponsesCandidate[]> => client.$queryRaw<TResponsesCandidate[]>`
  SELECT s."id", s."name", s."workspaceId", s."ownerId", s."createdBy",
         (SELECT MIN(r."created_at") FROM "Response" r WHERE r."surveyId" = s."id") AS "oldestResponseAt",
         n."sentAt" AS "noticeClaimedAt", n."deliveredAt" AS "noticeDeliveredAt",
         (SELECT MAX(LEAST(e."until", e."revokedAt")) FROM "RetentionExemption" e
           WHERE e."surveyId" = s."id" AND e."entity" = 'responses'
             AND LEAST(e."until", e."revokedAt") <= ${context.now}) AS "heldUntil"
  FROM "Survey" s
  JOIN "Workspace" w ON w."id" = s."workspaceId"
  LEFT JOIN "RetentionNotice" n ON n."surveyId" = s."id" AND n."entity" = 'responses'
  WHERE w."organizationId" = ${context.policy.organizationId}
    ${surveyId ? Prisma.sql`AND s."id" = ${surveyId}` : Prisma.empty}
    ${afterId ? Prisma.sql`AND s."id" > ${afterId}` : Prisma.empty}
    AND EXISTS (
      SELECT 1 FROM "Response" r WHERE r."surveyId" = s."id" AND r."created_at" <= ${noticeDueAtOrBefore}
    )
    AND NOT EXISTS (
      SELECT 1 FROM "RetentionExemption" e
      WHERE e."surveyId" = s."id" AND e."entity" = 'responses' AND e."revokedAt" IS NULL AND e."until" > ${context.now}
    )
  ORDER BY s."id"
  LIMIT ${RETENTION_SWEEP_BATCH_SIZE}
`;

/** Surveys held by an active responses exemption that would otherwise be due: History shows the skip. */
const readHeldSurveys = (context: TRetentionSweepContext, noticeDueAtOrBefore: Date) =>
  prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT DISTINCT s."id", s."name"
    FROM "RetentionExemption" e
    JOIN "Survey" s ON s."id" = e."surveyId"
    WHERE e."organizationId" = ${context.policy.organizationId} AND e."entity" = 'responses'
      AND e."revokedAt" IS NULL AND e."until" > ${context.now}
      AND EXISTS (
        SELECT 1 FROM "Response" r WHERE r."surveyId" = s."id" AND r."created_at" <= ${noticeDueAtOrBefore}
      )
  `;

const auditDeletion = async (
  context: TRetentionSweepContext,
  survey: { id: string; workspaceId: string },
  responseIds: string[]
): Promise<void> => {
  try {
    await queueAuditEventWithoutRequest({
      action: "deleted",
      targetType: "response",
      targetId: UNKNOWN_DATA,
      organizationId: context.policy.organizationId,
      userId: "system",
      userType: "system",
      status: "success",
      // Identity only, as the v3 batch delete records it.
      oldObject: {
        surveyId: survey.id,
        workspaceId: survey.workspaceId,
        deleted: responseIds.length,
        responseIds,
        retentionRunId: context.runId,
      },
    });
  } catch (error) {
    logger.error({ error, surveyId: survey.id }, "Data retention response deletion audit failed");
  }
};

/**
 * Delete a survey's due responses (created more than `periodDays` ago), a batch per transaction, until
 * none are left or the run's time is up. Every batch locks the survey (an exemption being created waits,
 * its foreign key needing the row), holds the policy unchanged, and re-reads the survey's schedule: the
 * reminder must still be valid and have run its full warning (`getDueRetentionStep` → `act`), and no
 * exemption may hold it. The deleted rows' files and Hub records are queued in the same transaction.
 * Once nothing is left in the warning window, the reminder is forgotten so the next responses to become
 * due get a new one.
 */
export const deleteDueResponses = async (
  context: TRetentionSweepContext,
  survey: TResponsesCandidate,
  cutoffs: { noticeDueAtOrBefore: Date; actionDueAtOrBefore: Date }
): Promise<void> => {
  while (Date.now() < context.deadline) {
    const batch = await runSweepTransaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Survey" WHERE "id" = ${survey.id} FOR UPDATE`;
      await lockUnchangedRetentionPolicy(tx, context.policy);
      const [current] = await readCandidates(tx, context, {
        surveyId: survey.id,
        noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore,
      });
      if (!current || getDueRetentionStep(context.policy, targetState(current), context.now) !== "act") {
        return null;
      }

      const due = await tx.response.findMany({
        where: { surveyId: survey.id, createdAt: { lte: cutoffs.actionDueAtOrBefore } },
        select: { id: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: RETENTION_SWEEP_BATCH_SIZE,
      });
      if (due.length === 0) return null;

      const { deletedIds, fileUrls } = await deleteResponsesInTransaction(tx, {
        surveyId: survey.id,
        id: { in: due.map((row) => row.id) },
      });
      const { drainNowIds } = await enqueueResponsesDeletionCleanups(tx, {
        organizationId: context.policy.organizationId,
        workspaceId: current.workspaceId,
        surveyId: survey.id,
        responseIds: deletedIds,
        fileUrls,
      });
      await recordRetentionRunDeletion(
        tx,
        context.runId,
        { targetType: "survey", targetId: survey.id, targetName: current.name },
        deletedIds.length
      );

      const leftInWindow = await tx.response.findFirst({
        where: { surveyId: survey.id, createdAt: { lte: cutoffs.noticeDueAtOrBefore } },
        select: { id: true },
      });
      if (!leftInWindow) {
        await deleteRetentionNotice(tx, {
          organizationId: context.policy.organizationId,
          entity: "responses",
          surveyId: survey.id,
        });
      }
      return {
        deletedIds,
        drainNowIds,
        workspaceId: current.workspaceId,
        more: due.length === RETENTION_SWEEP_BATCH_SIZE,
      };
    });
    if (!batch) return;

    await auditDeletion(context, { id: survey.id, workspaceId: batch.workspaceId }, batch.deletedIds);
    try {
      await drainDeletionCleanups({ ids: batch.drainNowIds });
    } catch (error) {
      logger.error(
        { error, surveyId: survey.id },
        "Deferred deleted responses' storage cleanup to the drain job"
      );
    }
    if (!batch.more) return;
  }
};

/**
 * The responses policy (ENG-3612): responses are deleted once older than `periodDays`. The first time a
 * survey's responses become due, its notice recipient gets one reminder; nothing is deleted until that
 * reminder was delivered and has run `warnDays`. After that, later responses go without another email
 * until the survey has none left in the warning window. An exemption on the responses policy holds the
 * survey; when it ends, a new reminder is due before anything goes.
 */
export const createResponsesSweeper =
  (canRead?: TSurveyReadCheck): TRetentionSweeper =>
  async (context) => {
    const cutoffs = getRetentionClockCutoffs(context.policy, context.now);
    const organization = await prisma.organization.findUniqueOrThrow({
      where: { id: context.policy.organizationId },
      select: { name: true, displayTimeZone: true },
    });
    const noticeOrganization: TNoticeOrganization = {
      name: organization.name,
      timeZone: getReportingTimeZone(organization.displayTimeZone),
    };

    const toNotify: TResponsesCandidate[] = [];
    let afterId: string | undefined;
    while (Date.now() < context.deadline) {
      const candidates = await readCandidates(prisma, context, {
        afterId,
        noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore,
      });
      for (const candidate of candidates) {
        const step = getDueRetentionStep(context.policy, targetState(candidate), context.now);
        if (step === "notify") toNotify.push(candidate);
        if (step === "act" && cutoffs.actionDueAtOrBefore && Date.now() < context.deadline) {
          await deleteDueResponses(context, candidate, {
            noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore,
            actionDueAtOrBefore: cutoffs.actionDueAtOrBefore,
          });
        }
      }
      if (candidates.length < RETENTION_SWEEP_BATCH_SIZE) break;
      afterId = candidates.at(-1)?.id;
    }

    const recipients = await resolveSurveyNoticeRecipients(context.policy.organizationId, toNotify, canRead);
    const items: TSurveyNoticeItem<"responses">[] = [];
    const noRecipient: TResponsesCandidate[] = [];
    for (const candidate of toNotify) {
      const recipient = recipients.get(candidate.id);
      if (!recipient) {
        noRecipient.push(candidate);
        continue;
      }
      // The dates the email states: the schedule as it reads once this notice is delivered now.
      const { actionAt } = getRetentionSchedule(
        context.policy,
        { ...targetState(candidate), noticeClaimedAt: null, noticeDeliveredAt: null },
        context.now
      );
      const dueCount = await countSurveyResponsesCreatedAtOrBefore(
        candidate.id,
        addRetentionDays(actionAt, -context.policy.periodDays)
      );
      items.push({
        survey: candidate,
        recipient,
        voidBefore: [context.policy.enabledAt, candidate.heldUntil]
          .filter((date): date is Date => date !== null)
          .reduce((a, b) => (a > b ? a : b)),
        describe: (format, url) => ({
          name: candidate.name,
          url,
          count:
            dueCount.relation === "gte"
              ? `${format.number(SURVEY_RETENTION_DUE_COUNT_CAP)}+`
              : format.number(dueCount.count),
          deleteDate: format.date(actionAt),
        }),
      });
    }

    await sendSurveyNotices(context, "responses", noticeOrganization, items);

    const held = await readHeldSurveys(context, cutoffs.noticeDueAtOrBefore);
    await recordRetentionRunSkips(context, [
      ...held.map((survey) => ({
        targetType: "survey" as const,
        targetId: survey.id,
        targetName: survey.name,
        skipReason: "exempt" as const,
      })),
      ...noRecipient.map((survey) => ({
        targetType: "survey" as const,
        targetId: survey.id,
        targetName: survey.name,
        skipReason: "noRecipient" as const,
      })),
    ]);
  };
