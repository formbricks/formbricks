import "server-only";
import { Prisma, type RetentionSurveyCondition } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { queueAuditEventWithoutRequest } from "@/modules/ee/audit-logs/lib/handler";
import { archiveSurvey } from "@/modules/survey/lib/surveys";
import {
  type TRetentionTargetState,
  getDueRetentionStep,
  getRetentionClockCutoffs,
  getRetentionSchedule,
  getSurveyRetentionClock,
} from "../lib/schedule";
import { RETENTION_SWEEP_BATCH_SIZE } from "./constants";
import { collectDueTargets, latestOf, surveySkips } from "./due-targets";
import { type TSurveyReadCheck, resolveSurveyNoticeRecipients } from "./recipients";
import { recordRetentionRunActions, recordRetentionRunSkips } from "./run";
import type { TSurveyNoticeItem } from "./survey-notices";
import type { TRetentionSweepContext, TRetentionSweeper } from "./sweep";
import { lockUnchangedRetentionPolicy, runSweepTransaction } from "./transaction";

/** A live survey whose clock may be in the warning window, and what its schedule reads. */
type TSurveyCandidate = {
  id: string;
  name: string;
  workspaceId: string;
  ownerId: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  newestResponseAt: Date | null;
  noticeClaimedAt: Date | null;
  noticeDeliveredAt: Date | null;
  noticeClockAt: Date | null;
  heldUntil: Date | null;
};

const clockOf = (candidate: TSurveyCandidate, conditions: readonly RetentionSurveyCondition[]): Date =>
  getSurveyRetentionClock(
    {
      createdAt: candidate.createdAt,
      updatedAt: candidate.updatedAt,
      lastResponseAt: candidate.newestResponseAt,
    },
    conditions
  );

const targetState = (
  candidate: TSurveyCandidate,
  conditions: readonly RetentionSurveyCondition[]
): TRetentionTargetState => ({
  clock: clockOf(candidate, conditions),
  noticeClaimedAt: candidate.noticeClaimedAt,
  noticeDeliveredAt: candidate.noticeDeliveredAt,
  noticeClockAt: candidate.noticeClockAt,
  heldUntil: candidate.heldUntil,
  archivedAt: null,
});

/**
 * The ticked conditions as SQL over `Survey s`, beyond the `updated_at` bound that always applies: "no
 * response" needs no response after the cutoff (one index probe on `Response(surveyId, created_at)`),
 * "created before" the creation date.
 */
const conditionClauses = (conditions: readonly RetentionSurveyCondition[], cutoff: Date): Prisma.Sql =>
  Prisma.sql`
    ${
      conditions.includes("noResponse")
        ? Prisma.sql`AND NOT EXISTS (
            SELECT 1 FROM "Response" r WHERE r."surveyId" = s."id" AND r."created_at" > ${cutoff}
          )`
        : Prisma.empty
    }
    ${conditions.includes("createdBefore") ? Prisma.sql`AND s."created_at" <= ${cutoff}` : Prisma.empty}
  `;

/**
 * The organisation's live surveys whose clock is at or before `noticeDueAtOrBefore`, held by no active
 * exemption on either policy (deleting a survey deletes its responses, so a responses exemption holds it
 * too), keyset-paged on the id. The ticked conditions are pushed into SQL: `updated_at` always counts,
 * "no response" needs no response after the cutoff (one index probe on `Response(surveyId, created_at)`),
 * "created before" the creation date. `surveyId` narrows it to one survey, for the re-check under lock.
 */
const readCandidates = (
  client: Pick<Prisma.TransactionClient, "$queryRaw">,
  context: TRetentionSweepContext,
  {
    afterId,
    surveyId,
    noticeDueAtOrBefore,
  }: { afterId?: string; surveyId?: string; noticeDueAtOrBefore: Date }
): Promise<TSurveyCandidate[]> => {
  return client.$queryRaw<TSurveyCandidate[]>`
    SELECT s."id", s."name", s."workspaceId", s."ownerId", s."createdBy",
           s."created_at" AS "createdAt", s."updated_at" AS "updatedAt",
           (SELECT MAX(r."created_at") FROM "Response" r WHERE r."surveyId" = s."id") AS "newestResponseAt",
           n."sentAt" AS "noticeClaimedAt", n."deliveredAt" AS "noticeDeliveredAt",
           n."clockAt" AS "noticeClockAt",
           -- Every exemption's end on either policy, including one revoked after the run opened: a notice
           -- claimed before it is void. An active one keeps the survey out altogether (below).
           (SELECT MAX(LEAST(e."until", e."revokedAt")) FROM "RetentionExemption" e
             WHERE e."surveyId" = s."id") AS "heldUntil"
    FROM "Survey" s
    JOIN "Workspace" w ON w."id" = s."workspaceId"
    LEFT JOIN "RetentionNotice" n ON n."surveyId" = s."id" AND n."entity" = 'surveys'
    WHERE w."organizationId" = ${context.policy.organizationId}
      AND s."archivedAt" IS NULL
      -- A survey scheduled to launch later hasn't had its chance yet.
      AND (s."publishOn" IS NULL OR s."publishOn" <= ${context.now})
      AND s."updated_at" <= ${noticeDueAtOrBefore}
      ${conditionClauses(context.policy.conditions, noticeDueAtOrBefore)}
      ${surveyId ? Prisma.sql`AND s."id" = ${surveyId}` : Prisma.empty}
      ${afterId ? Prisma.sql`AND s."id" > ${afterId}` : Prisma.empty}
      AND NOT EXISTS (
        SELECT 1 FROM "RetentionExemption" e
        WHERE e."surveyId" = s."id" AND e."revokedAt" IS NULL AND e."until" > ${context.now}
      )
    ORDER BY s."id"
    LIMIT ${RETENTION_SWEEP_BATCH_SIZE}
  `;
};

/** Live surveys held by an active exemption whose clock would otherwise be due: History shows the skip. */
const readHeldSurveys = (context: TRetentionSweepContext, noticeDueAtOrBefore: Date) =>
  runSweepTransaction(
    (tx) => tx.$queryRaw<{ id: string; name: string }[]>`
      SELECT DISTINCT s."id", s."name"
      FROM "RetentionExemption" e
      JOIN "Survey" s ON s."id" = e."surveyId"
      JOIN "Workspace" w ON w."id" = s."workspaceId"
      WHERE w."organizationId" = ${context.policy.organizationId}
        AND e."organizationId" = ${context.policy.organizationId}
        AND e."revokedAt" IS NULL AND e."until" > ${context.now}
        AND s."archivedAt" IS NULL AND s."updated_at" <= ${noticeDueAtOrBefore}
        AND (s."publishOn" IS NULL OR s."publishOn" <= ${context.now})
        ${conditionClauses(context.policy.conditions, noticeDueAtOrBefore)}
    `
  );

/**
 * Archive one survey whose notice has run its full warning. In one transaction: lock the survey (an
 * exemption being created waits, its foreign key needing the row, and a restore or edit waits too), hold
 * the policy unchanged, re-read the survey (still live, still unheld, the same clock) and re-check that
 * the schedule says `act`, then archive it (a live survey is paused) and record it. The archive purge
 * deletes it `SURVEY_ARCHIVE_RETENTION_DAYS` later, as it does every archived survey.
 */
export const archiveDueSurvey = async (
  context: TRetentionSweepContext,
  surveyId: string,
  noticeDueAtOrBefore: Date
): Promise<boolean> => {
  const archived = await runSweepTransaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "Survey" WHERE "id" = ${surveyId} FOR UPDATE`;
    await lockUnchangedRetentionPolicy(tx, context.policy);
    const [current] = await readCandidates(tx, context, { surveyId, noticeDueAtOrBefore });
    if (
      !current ||
      getDueRetentionStep(context.policy, targetState(current, context.policy.conditions), context.now) !==
        "act"
    ) {
      return null;
    }
    await archiveSurvey(surveyId, { tx });
    await recordRetentionRunActions(tx, context.runId, [
      { targetType: "survey", targetId: surveyId, targetName: current.name, action: "archived" },
    ]);
    return current;
  });
  if (!archived) return false;

  try {
    await queueAuditEventWithoutRequest({
      action: "archived",
      targetType: "survey",
      targetId: surveyId,
      organizationId: context.policy.organizationId,
      userId: "system",
      userType: "system",
      status: "success",
      newObject: { workspaceId: archived.workspaceId, retentionRunId: context.runId },
    });
  } catch (error) {
    logger.error({ error, surveyId }, "Data retention survey archive audit failed");
  }
  return true;
};

/**
 * The surveys policy (ENG-3612): a survey whose ticked conditions have held for `periodDays` is archived,
 * and the archive purge deletes it 30 days later. Its notice recipient is told `warnDays` before, in the
 * night's one email per person (with any responses reminders); nothing is archived until that notice was
 * delivered and has run in full.
 * Any activity that moves the survey's clock voids the notice, and an exemption on either policy holds
 * the survey. Surveys archived by hand are the purge's alone.
 */
export const createSurveysSweeper =
  (canRead?: TSurveyReadCheck): TRetentionSweeper =>
  async (context) => {
    const { conditions } = context.policy;
    const cutoffs = getRetentionClockCutoffs(context.policy, context.now);
    const { notify, act } = await collectDueTargets(context, {
      readPage: (tx, afterId) =>
        readCandidates(tx, context, { afterId, noticeDueAtOrBefore: cutoffs.noticeDueAtOrBefore }),
      keyOf: (candidate) => candidate.id,
      stepOf: (candidate) =>
        getDueRetentionStep(context.policy, targetState(candidate, conditions), context.now),
    });

    const recipients = await resolveSurveyNoticeRecipients(context.policy.organizationId, notify, canRead);
    const items: TSurveyNoticeItem<"surveys">[] = notify.flatMap((candidate) => {
      const recipient = recipients.get(candidate.id);
      if (!recipient) return [];
      const target = targetState(candidate, conditions);
      // The dates the email states: the schedule as it reads once this notice is delivered now.
      const { actionAt, deleteAt } = getRetentionSchedule(
        context.policy,
        { ...target, noticeClaimedAt: null, noticeDeliveredAt: null },
        context.now
      );
      return [
        {
          survey: candidate,
          recipient,
          voidBefore: latestOf(context.policy.enabledAt, candidate.heldUntil),
          // The clock read above: a survey changed since then voids this notice once it is claimed.
          clockAt: target.clock,
          describe: (format, url) => ({
            name: candidate.name,
            url,
            archiveDate: format.date(actionAt),
            deleteDate: format.date(deleteAt ?? actionAt),
          }),
        },
      ];
    });

    return {
      surveyNotices: { context, entity: "surveys", items },
      act: async (deadline) => {
        for (const candidate of act) {
          if (Date.now() >= deadline) break;
          await archiveDueSurvey({ ...context, deadline }, candidate.id, cutoffs.noticeDueAtOrBefore);
        }
        await recordRetentionRunSkips(
          context,
          surveySkips(
            await readHeldSurveys(context, cutoffs.noticeDueAtOrBefore),
            notify.filter((candidate) => !recipients.has(candidate.id))
          )
        );
      },
    };
  };
