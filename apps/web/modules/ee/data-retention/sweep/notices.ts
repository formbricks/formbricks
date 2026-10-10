import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@formbricks/database/prisma";

/**
 * A claim that was never delivered is taken over after this: the sender crashed, or the email failed.
 * Far longer than any send, so a claim in flight is never taken from under its sender.
 */
export const RETENTION_NOTICE_STALE_CLAIM_MS = 6 * 60 * 60 * 1000;

export type TRetentionNoticeTarget =
  | { organizationId: string; entity: "surveys" | "responses"; surveyId: string }
  | { organizationId: string; entity: "members"; userId: string };

/**
 * Claim the target's notice for sending, so exactly one sweep sends it, or return null. One statement:
 * the row is created, or an existing one is taken over only when it no longer counts — a delivered notice
 * claimed before `voidBefore` (the policy's `enabledAt` and the end of the target's latest exemption) or
 * computed for another clock than `clockAt` (the same rule as `getValidNoticeDeliveredAt`), or a claim
 * never delivered and older than `RETENTION_NOTICE_STALE_CLAIM_MS`. A valid notice, or a fresh claim in
 * flight, is left alone. The returned token ties the delivery to this claim.
 *
 * `clockAt` is the target's clock the notice's dates were computed from, stored with the claim: for
 * surveys and members, the notice counts only while the target's clock is still that, so activity
 * between the sweep reading the target and this claim voids it rather than leaving a notice whose dates
 * are wrong. Null for the responses reminder, which follows no one clock.
 */
export const claimRetentionNotice = async (
  tx: Prisma.TransactionClient,
  target: TRetentionNoticeTarget,
  { claimedAt, voidBefore, clockAt }: { claimedAt: Date; voidBefore: Date; clockAt: Date | null }
): Promise<string | null> => {
  const claimToken = createId();
  const staleBefore = new Date(claimedAt.getTime() - RETENTION_NOTICE_STALE_CLAIM_MS);
  const surveyId = target.entity === "members" ? null : target.surveyId;
  const userId = target.entity === "members" ? target.userId : null;
  // The conflict target names the unique index for the kind of notice; a literal, never input.
  const conflictTarget =
    target.entity === "members"
      ? Prisma.raw(`("userId", "organizationId", "entity")`)
      : Prisma.raw(`("surveyId", "entity")`);

  const rows = await tx.$queryRaw<{ claimToken: string }[]>`
    INSERT INTO "RetentionNotice"
      ("id", "organizationId", "entity", "surveyId", "userId", "sentAt", "deliveredAt", "emailSent", "claimToken",
       "clockAt")
    VALUES (${createId()}, ${target.organizationId}, ${target.entity}::"RetentionEntity", ${surveyId}, ${userId},
            ${claimedAt}, NULL, false, ${claimToken}, ${clockAt})
    ON CONFLICT ${conflictTarget} DO UPDATE
    SET "sentAt" = EXCLUDED."sentAt", "deliveredAt" = NULL, "emailSent" = false, "claimToken" = EXCLUDED."claimToken",
        "clockAt" = EXCLUDED."clockAt"
    WHERE ("RetentionNotice"."deliveredAt" IS NULL AND "RetentionNotice"."sentAt" < ${staleBefore})
       OR ("RetentionNotice"."deliveredAt" IS NOT NULL
           AND ("RetentionNotice"."sentAt" < ${voidBefore} OR "RetentionNotice"."clockAt" IS DISTINCT FROM ${clockAt}))
    RETURNING "claimToken"
  `;
  return rows[0]?.claimToken ?? null;
};

/**
 * Record that a claimed notice reached the mail transport (or was recorded without one: no SMTP), so its
 * warning starts. Only the claim that sent the email can do it, and only once; false means the claim was
 * taken over meanwhile, and the newer one will record its own delivery.
 */
export const markRetentionNoticeDelivered = async (
  tx: Prisma.TransactionClient,
  target: TRetentionNoticeTarget,
  { claimToken, deliveredAt, emailSent }: { claimToken: string; deliveredAt: Date; emailSent: boolean }
): Promise<boolean> =>
  (await tx.$executeRaw`
    UPDATE "RetentionNotice"
    SET "deliveredAt" = ${deliveredAt}, "emailSent" = ${emailSent}
    WHERE ${noticeTargetWhere(target)} AND "claimToken" = ${claimToken} AND "deliveredAt" IS NULL
  `) === 1;

/** The target's notice, by the unique index for its kind. */
const noticeTargetWhere = (target: TRetentionNoticeTarget): Prisma.Sql =>
  target.entity === "members"
    ? Prisma.sql`"userId" = ${target.userId} AND "organizationId" = ${target.organizationId} AND "entity" = 'members'`
    : Prisma.sql`"surveyId" = ${target.surveyId} AND "entity" = ${target.entity}::"RetentionEntity"`;

/**
 * Forget the target's notice, so the next time it becomes due it gets a new one. The responses reminder
 * is re-armed this way once a survey has no response left in its warning window.
 */
export const deleteRetentionNotice = async (
  tx: Prisma.TransactionClient,
  target: TRetentionNoticeTarget
): Promise<void> => {
  await tx.$executeRaw`DELETE FROM "RetentionNotice" WHERE ${noticeTargetWhere(target)}`;
};
