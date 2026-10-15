import "server-only";
import type { Prisma, RetentionSurveyCondition } from "@formbricks/database/prisma";
import { getSurveyRetentionClock } from "../lib/schedule";
import { latestOf } from "./due-targets";

/**
 * Mark the rest of this transaction's response deletes as the responses policy's own: the
 * `retention_notice_void_on_response_delete` trigger then leaves the surveys' archive notices alone, and
 * `restampSurveyNoticeAfterRetentionDeletion` re-stamps them instead. Transaction-local
 * (`set_config(…, true)`), so it never outlives the policy's delete, on a pooled connection either.
 */
export const markRetentionPolicyDelete = async (tx: Prisma.TransactionClient): Promise<void> => {
  await tx.$queryRaw`SELECT set_config('formbricks.retention_policy_delete', 'on', true)`;
};

/**
 * Keep the surveys policy's archive notice valid across the responses policy's own deletions (ENG-3612).
 *
 * A survey's archive notice holds only while the survey's clock is the one it was computed for
 * (`RetentionNotice.clockAt`, `NOTICE_FOLLOWS_CLOCK`). Under "no response" the clock is the newest
 * response, so deleting responses moves it back: to an older response, or to the last edit once none is
 * left. When a person deletes responses that is a change to the survey: the
 * `retention_notice_void_on_response_delete` trigger clears the notice's `clockAt`, so the owner is warned
 * again and the full warning restarts. When the responses policy deletes them
 * (`markRetentionPolicyDelete`) it is the retention the notice already announced, not activity, so this
 * re-stamps the notice for the clock the survey has now. Otherwise the deletion would void the notice
 * every night, the owner would get the same email again, and the archive would slip a full warning each
 * time.
 *
 * Only a notice computed for the clock before this deletion is re-stamped. Any other notice is already
 * void (a response came in after it, say) and is cleared to `NULL`, which no clock equals: otherwise the
 * clock this deletion leaves could be the very one that notice was computed for, and it would count again
 * with no new email. A void notice is never brought back.
 *
 * Runs in the responses policy's deleting transaction, after the delete, with the survey locked
 * `FOR UPDATE` (no response can be added in between) and the responses policy held `FOR SHARE`. The
 * surveys policy is then taken `FOR SHARE` too, after the responses policy, in the order every path that
 * locks several of an organisation's policies takes them (`openRetentionRuns`, `recordRetentionDeferral`);
 * an edit only ever locks its own row.
 *
 * `newestDeletedAt` is the newest `createdAt` among the responses just deleted: with the newest response
 * left, it gives the clock before the deletion without a second probe.
 */
export const restampSurveyNoticeAfterRetentionDeletion = async (
  tx: Prisma.TransactionClient,
  {
    organizationId,
    surveyId,
    newestDeletedAt,
  }: { organizationId: string; surveyId: string; newestDeletedAt: Date }
): Promise<void> => {
  const [policy] = await tx.$queryRaw<{ conditions: RetentionSurveyCondition[] }[]>`
    SELECT "conditions"::text[] AS "conditions"
    FROM "RetentionPolicy"
    WHERE "organizationId" = ${organizationId} AND "entity" = 'surveys' AND "enabled"
    FOR SHARE
  `;
  // Without "no response" the clock follows no response, so a deletion cannot move it.
  if (!policy?.conditions.includes("noResponse")) return;

  // One probe on `Response(surveyId, created_at)` for what is left.
  const [survey] = await tx.$queryRaw<
    { createdAt: Date; updatedAt: Date; newestResponseAt: Date | null; restoredAt: Date | null }[]
  >`
    SELECT s."created_at" AS "createdAt", s."updated_at" AS "updatedAt",
           (SELECT MAX(r."created_at") FROM "Response" r WHERE r."surveyId" = s."id") AS "newestResponseAt",
           rs."restoredAt" AS "restoredAt"
    FROM "Survey" s
    LEFT JOIN "RetentionSurveyRestore" rs ON rs."surveyId" = s."id"
    WHERE s."id" = ${surveyId}
  `;
  if (!survey) return;

  const clockWith = (lastResponseAt: Date | null) =>
    getSurveyRetentionClock(
      {
        createdAt: survey.createdAt,
        updatedAt: survey.updatedAt,
        lastResponseAt,
        restoredAt: survey.restoredAt,
      },
      policy.conditions
    );
  const before = clockWith(latestOf(newestDeletedAt, survey.newestResponseAt));
  const after = clockWith(survey.newestResponseAt);
  if (before.getTime() === after.getTime()) return;

  await tx.$executeRaw`
    UPDATE "RetentionNotice"
    SET "clockAt" = CASE WHEN "clockAt" = ${before}::timestamp(3) THEN ${after}::timestamp(3) ELSE NULL END
    WHERE "surveyId" = ${surveyId} AND "entity" = 'surveys' AND "clockAt" IS NOT NULL
  `;
};
