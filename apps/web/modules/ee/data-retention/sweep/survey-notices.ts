import "server-only";
import type { TRetentionNoticeArchivedSurvey, TRetentionNoticeResponseDeletion } from "@formbricks/email";
import { logger } from "@formbricks/logger";
import { WEBAPP_URL } from "@/lib/constants";
import { sendSurveyRetentionNoticeEmail } from "@/modules/email";
import { formatRetentionDate } from "../lib/display";
import { RETENTION_NOTICES_PER_RUN, RETENTION_SWEEP_BATCH_SIZE } from "./constants";
import { claimRetentionNotice, markRetentionNoticeDelivered } from "./notices";
import type { TNoticeRecipient } from "./recipients";
import { recordRetentionRunActions } from "./run";
import type { TRetentionSweepContext } from "./sweep";
import { lockUnchangedRetentionPolicy, readDatabaseClock, runSweepTransaction } from "./transaction";

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

/**
 * Send one policy's survey notices for the night:
 * - claim each survey's notice (`claimRetentionNotice`, so a void one is replaced and two sweeps never
 *   both send it), a batch per transaction, at most `RETENTION_NOTICES_PER_RUN` a run;
 * - one email per person listing their surveys, until the run's deadline;
 * - record each delivery and its History row in one transaction per person.
 * A claim taken by another sweep, or already valid, is left out. When sending throws, or the deadline
 * stops the run first, those claims stay undelivered: nothing acts on them, and they are claimed again
 * once stale. Delivery is at least once: if recording it fails after the email went out, the next
 * claim sends it again. Without SMTP the notices are recorded as delivered with no email, as decided;
 * the History row then names no recipient.
 */
export const sendSurveyNotices = async <TEntity extends "surveys" | "responses">(
  context: TRetentionSweepContext,
  entity: TEntity,
  organization: TNoticeOrganization,
  allItems: readonly TSurveyNoticeItem<TEntity>[]
): Promise<void> => {
  const items = allItems.slice(0, RETENTION_NOTICES_PER_RUN);
  if (items.length === 0) return;

  const claimed: (TSurveyNoticeItem<TEntity> & { claimToken: string })[] = [];
  for (let i = 0; i < items.length && Date.now() < context.deadline; i += RETENTION_SWEEP_BATCH_SIZE) {
    const batch = items.slice(i, i + RETENTION_SWEEP_BATCH_SIZE);
    claimed.push(
      ...(await runSweepTransaction(async (tx) => {
        await lockUnchangedRetentionPolicy(tx, context.policy);
        const claimedAt = await readDatabaseClock(tx);
        const result: (TSurveyNoticeItem<TEntity> & { claimToken: string })[] = [];
        for (const item of batch) {
          const claimToken = await claimRetentionNotice(
            tx,
            { organizationId: context.policy.organizationId, entity, surveyId: item.survey.id },
            { claimedAt, voidBefore: item.voidBefore }
          );
          if (claimToken) result.push({ ...item, claimToken });
        }
        return result;
      }))
    );
  }

  const byRecipient = new Map<string, typeof claimed>();
  for (const item of claimed) {
    byRecipient.set(item.recipient.userId, [...(byRecipient.get(item.recipient.userId) ?? []), item]);
  }

  for (const recipientItems of byRecipient.values()) {
    if (Date.now() >= context.deadline) break;
    const { recipient } = recipientItems[0];
    const format = formatFor(recipient.locale, organization.timeZone);
    const lines = recipientItems.map((item) => item.describe(format, surveyUrl(item.survey)));

    let emailSent: boolean;
    try {
      emailSent = await sendSurveyRetentionNoticeEmail({
        email: recipient.email,
        locale: recipient.locale,
        organizationId: context.policy.organizationId,
        organizationName: organization.name,
        archivedSurveys: entity === "surveys" ? (lines as TRetentionNoticeArchivedSurvey[]) : [],
        responseDeletions: entity === "responses" ? (lines as TRetentionNoticeResponseDeletion[]) : [],
      });
    } catch (error) {
      logger.error(
        { error, runId: context.runId, entity, surveyCount: recipientItems.length },
        "Data retention notice email failed; the notices stay unsent"
      );
      continue;
    }

    await runSweepTransaction(async (tx) => {
      const deliveredAt = await readDatabaseClock(tx);
      const delivered: typeof recipientItems = [];
      for (const item of recipientItems) {
        const target = { organizationId: context.policy.organizationId, entity, surveyId: item.survey.id };
        if (
          await markRetentionNoticeDelivered(tx, target, {
            claimToken: item.claimToken,
            deliveredAt,
            emailSent,
          })
        ) {
          delivered.push(item);
        }
      }
      await recordRetentionRunActions(
        tx,
        context.runId,
        delivered.map((item) => ({
          targetType: "survey" as const,
          targetId: item.survey.id,
          targetName: item.survey.name,
          action: "notified" as const,
          recipient: emailSent ? recipient.email : null,
        }))
      );
    });
  }
};
