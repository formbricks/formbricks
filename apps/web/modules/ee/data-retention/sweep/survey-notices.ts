import "server-only";
import type { TRetentionNoticeArchivedSurvey, TRetentionNoticeResponseDeletion } from "@formbricks/email";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { formatRetentionDate } from "../lib/display";
import { RETENTION_NOTICES_PER_RUN, RETENTION_SWEEP_BATCH_SIZE } from "./constants";
import { loadNoticeOrganization } from "./due-targets";
import { claimRetentionNotice, markRetentionNoticeDelivered } from "./notices";
import type { TNoticeRecipient } from "./recipients";
import { recordRetentionRunActions } from "./run";
import type { TRetentionSweepContext } from "./sweep";
import {
  RetentionPolicyChangedError,
  lockUnchangedRetentionPolicy,
  readDatabaseClock,
  runSweepTransaction,
} from "./transaction";

export type TNoticeOrganization = { name: string; timeZone: string };

/** How a notice line reads for one reader: dates in their locale, counts in their number format. */
export type TNoticeFormat = { date: (date: Date) => string; number: (value: number) => string };

export type TSurveyNoticeItem<TEntity extends "surveys" | "responses"> = {
  survey: { id: string; name: string; workspaceId: string };
  recipient: TNoticeRecipient;
  /** The notice counts only if claimed at or after this (`getValidNoticeDeliveredAt`'s rule). */
  voidBefore: Date;
  /** The survey's line in the email, for one reader. */
  describe: (format: TNoticeFormat, url: string) => TNoticeLine<TEntity>;
};

export type TNoticeLine<TEntity extends "surveys" | "responses"> = TEntity extends "responses"
  ? TRetentionNoticeResponseDeletion
  : TRetentionNoticeArchivedSurvey;

const surveyUrl = (survey: { id: string; workspaceId: string }) =>
  `${WEBAPP_URL}/workspaces/${survey.workspaceId}/surveys/${survey.id}/summary`;

/** Dates as the rest of Data retention shows them, in the organisation's reporting time zone. */
const formatFor = (locale: string, timeZone: string): TNoticeFormat => {
  const numberFormat = new Intl.NumberFormat(locale);
  return {
    date: (date) => formatRetentionDate(date.toISOString(), locale, timeZone),
    number: (value) => numberFormat.format(value),
  };
};

type TNoticeBatchOf<TEntity extends "surveys" | "responses"> = {
  context: TRetentionSweepContext;
  entity: TEntity;
  items: readonly TSurveyNoticeItem<TEntity>[];
};

/** One survey policy's notices for the night. */
export type TSurveyNoticeBatch = TNoticeBatchOf<"surveys"> | TNoticeBatchOf<"responses">;

type TClaimedNotice = (
  | (TSurveyNoticeItem<"surveys"> & { entity: "surveys" })
  | (TSurveyNoticeItem<"responses"> & { entity: "responses" })
) & { context: TRetentionSweepContext; claimToken: string };

/**
 * Claim a batch's notices (`claimRetentionNotice`: a void one is replaced, and two sweeps never both send
 * one), a hundred per transaction under the policy's unchanged-lock, at most `RETENTION_NOTICES_PER_RUN`
 * a run. A notice taken by another sweep, or still valid, is left out. Stops at the deadline.
 */
const claimBatch = async (batch: TSurveyNoticeBatch, deadline: number): Promise<TClaimedNotice[]> => {
  const items = batch.items.slice(0, RETENTION_NOTICES_PER_RUN) as TSurveyNoticeItem<typeof batch.entity>[];
  const claimed: TClaimedNotice[] = [];
  for (let i = 0; i < items.length && Date.now() < deadline; i += RETENTION_SWEEP_BATCH_SIZE) {
    const chunk = items.slice(i, i + RETENTION_SWEEP_BATCH_SIZE);
    await runSweepTransaction(async (tx) => {
      await lockUnchangedRetentionPolicy(tx, batch.context.policy);
      const claimedAt = await readDatabaseClock(tx);
      for (const item of chunk) {
        const claimToken = await claimRetentionNotice(
          tx,
          {
            organizationId: batch.context.policy.organizationId,
            entity: batch.entity,
            surveyId: item.survey.id,
          },
          { claimedAt, voidBefore: item.voidBefore }
        );
        if (claimToken) {
          claimed.push({
            ...item,
            entity: batch.entity,
            context: batch.context,
            claimToken,
          } as TClaimedNotice);
        }
      }
    });
  }
  return claimed;
};

/** Record the notices an email carried as delivered, with their History rows on each policy's run. */
const recordDelivered = (notices: readonly TClaimedNotice[], emailSent: boolean, recipientEmail: string) =>
  runSweepTransaction(async (tx) => {
    const deliveredAt = await readDatabaseClock(tx);
    const delivered: TClaimedNotice[] = [];
    for (const notice of notices) {
      const target = {
        organizationId: notice.context.policy.organizationId,
        entity: notice.entity,
        surveyId: notice.survey.id,
      };
      if (
        await markRetentionNoticeDelivered(tx, target, {
          claimToken: notice.claimToken,
          deliveredAt,
          emailSent,
        })
      ) {
        delivered.push(notice);
      }
    }
    for (const runId of new Set(delivered.map((notice) => notice.context.runId))) {
      await recordRetentionRunActions(
        tx,
        runId,
        delivered
          .filter((notice) => notice.context.runId === runId)
          .map((notice) => ({
            targetType: "survey" as const,
            targetId: notice.survey.id,
            targetName: notice.survey.name,
            action: "notified" as const,
            recipient: emailSent ? recipientEmail : null,
          }))
      );
    }
  });

/**
 * Send the night's survey notices of one organisation, from both survey policies at once:
 * - claim each policy's notices (`claimBatch`); a policy changed since its run read it stops only its
 *   own notices;
 * - one email per person, listing their surveys to be archived and their surveys whose responses will
 *   be deleted, until `deadline`;
 * - record each delivery and its History row on its policy's run, in one transaction per person.
 * When sending throws, or the deadline comes first, those claims stay undelivered: nothing acts on
 * them, and they are claimed again once stale. Delivery is at least once: if recording it fails after
 * the email went out, the next claim sends it again. Without SMTP the notices are recorded as delivered
 * with no email, as decided; the History row then names no recipient.
 */
export const sendSurveyNotices = async (
  batches: readonly TSurveyNoticeBatch[],
  deadline: number
): Promise<void> => {
  const claimed: TClaimedNotice[] = [];
  for (const batch of batches) {
    try {
      claimed.push(...(await claimBatch(batch, deadline)));
    } catch (error) {
      if (!(error instanceof RetentionPolicyChangedError)) throw error;
      logger.info(
        { runId: batch.context.runId },
        "Data retention policy changed before its notices; skipped"
      );
    }
  }
  if (claimed.length === 0) return;

  const organization = await loadNoticeOrganization(claimed[0].context.policy.organizationId);
  const byRecipient = new Map<string, TClaimedNotice[]>();
  for (const notice of claimed) {
    byRecipient.set(notice.recipient.userId, [...(byRecipient.get(notice.recipient.userId) ?? []), notice]);
  }

  for (const notices of byRecipient.values()) {
    if (Date.now() >= deadline) break;
    const { recipient } = notices[0];
    const format = formatFor(recipient.locale, organization.timeZone);
    const archivedSurveys: TRetentionNoticeArchivedSurvey[] = [];
    const responseDeletions: TRetentionNoticeResponseDeletion[] = [];
    for (const notice of notices) {
      if (notice.entity === "surveys")
        archivedSurveys.push(notice.describe(format, surveyUrl(notice.survey)));
      else responseDeletions.push(notice.describe(format, surveyUrl(notice.survey)));
    }

    let emailSent: boolean;
    try {
      emailSent = await sendSurveyRetentionNoticeEmail({
        email: recipient.email,
        locale: recipient.locale,
        organizationId: notices[0].context.policy.organizationId,
        organizationName: organization.name,
        archivedSurveys,
        responseDeletions,
      });
    } catch (error) {
      logger.error(
        { error, surveyCount: notices.length },
        "Data retention notice email failed; the notices stay unsent"
      );
      continue;
    }
    await recordDelivered(notices, emailSent, recipient.email);
  }
};
