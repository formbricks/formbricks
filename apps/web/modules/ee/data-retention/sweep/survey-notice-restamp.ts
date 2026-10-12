import "server-only";
import type { Prisma, RetentionSurveyCondition } from "@formbricks/database/prisma";
import { getSurveyRetentionClock } from "../lib/schedule";
import { latestOf } from "./due-targets";

/**
 * Keep the surveys policy's archive notice valid across the responses policy's own deletions (ENG-3612).
 *
 * A survey's archive notice holds only while the survey's clock is the one it was computed for
 * (`RetentionNotice.clockAt`, `NOTICE_FOLLOWS_CLOCK`). Under "no response" the clock is the newest
 * response, so deleting responses moves it: back to an older response, or to the last edit once none is
 * left. When a person deletes responses that is a change to the survey, and the notice is void: the
 * owner is warned again and the full warning restarts. When the responses policy deletes them it is the
 * retention the notice already announced, not activity, so this re-stamps the notice for the clock the
 * survey has now. Otherwise the deletion would void the notice every night, the owner would get the
 * same email again, and the archive would slip a full warning each time.
 *
 * Runs in the responses policy's deleting transaction, after the delete, with the survey locked
 * `FOR UPDATE` (no response can be added in between) and the responses policy held `FOR SHARE`. The
 * surveys policy is then taken `FOR SHARE` too: policies are always locked responses before surveys, as
 * `openRetentionRuns` does, and an edit only ever locks its own row. Only a notice computed for the clock
 * before this deletion is re-stamped, so a notice already void for another reason stays void, and none is
 * ever brought back.
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
  if (!policy) return;

  // One probe on `Response(surveyId, created_at)` for what is left.
  const [survey] = await tx.$queryRaw<{ createdAt: Date; updatedAt: Date; newestResponseAt: Date | null }[]>`
    SELECT s."created_at" AS "createdAt", s."updated_at" AS "updatedAt",
           (SELECT MAX(r."created_at") FROM "Response" r WHERE r."surveyId" = s."id") AS "newestResponseAt"
    FROM "Survey" s
    WHERE s."id" = ${surveyId}
  `;
  if (!survey) return;

  const clockWith = (lastResponseAt: Date | null) =>
    getSurveyRetentionClock(
      { createdAt: survey.createdAt, updatedAt: survey.updatedAt, lastResponseAt },
      policy.conditions
    );
  const before = clockWith(latestOf(newestDeletedAt, survey.newestResponseAt));
  const after = clockWith(survey.newestResponseAt);
  if (before.getTime() === after.getTime()) return;

  await tx.$executeRaw`
    UPDATE "RetentionNotice"
    SET "clockAt" = ${after}
    WHERE "surveyId" = ${surveyId} AND "entity" = 'surveys' AND "clockAt" = ${before}
  `;
};
