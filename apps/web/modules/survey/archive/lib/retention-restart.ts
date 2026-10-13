import "server-only";
import { createId } from "@paralleldrive/cuid2";
import type { Prisma } from "@formbricks/database/prisma";
import { readDatabaseClock } from "@/lib/utils/database-clock";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * What restoring a survey the surveys policy archived does to data retention: the survey gets a full
 * period again.
 *
 * Only a survey the policy archived since its last restore (History holds an `archived` row for it from a
 * sweep run that started after that restore). A survey archived by hand is restored as it always was,
 * with nothing restarted: otherwise anyone who may archive and restore it (an editor, an API key) could
 * restart its clocks, or get a period's exemption, at will, which only owners and managers may grant.
 *
 * - The restore is recorded (`RetentionSurveyRestore`, only ever moving forward), which starts the surveys
 *   policy's "no response" and "no change" periods over (`getSurveyRetentionClock`).
 * - Creation can't start over, so when the organisation's surveys policy is on and its only condition is
 *   "created before", the survey is exempted from it for one period instead, from now. The exemption is
 *   marked as the restore's (`source = 'restore'`, no reason), carries who restored it, and shows in the
 *   Exemptions tab, where an owner or manager can revoke it. A survey that already has an active surveys
 *   exemption keeps that one.
 *
 * Runs in the restore's transaction, with the survey row locked `FOR UPDATE`, so an exemption being added
 * through the API (its foreign key takes `FOR KEY SHARE` on the survey) waits for it, and the policy is
 * then held `FOR SHARE`, in the order the sweep takes them. Like the archive purge's exemption check
 * (`getSurveyPurgeEligibleWhere`), it reads the retention tables whether or not the organisation has the
 * licence: a hold is never the wrong side to err on. Returns the exemption's id when it made one.
 */
export const restartSurveyRetention = async (
  tx: Prisma.TransactionClient,
  {
    surveyId,
    organizationId,
    restoredById,
  }: { surveyId: string; organizationId: string; restoredById: string | null }
): Promise<{ exemptionId: string | null }> => {
  const [archived] = await tx.$queryRaw<{ byPolicy: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM "RetentionRunItem" i
      JOIN "RetentionRun" r ON r."id" = i."runId"
      WHERE i."targetId" = ${surveyId} AND i."targetType" = 'survey' AND i."action" = 'archived'
        AND r."entity" = 'surveys' AND r."kind" = 'sweep'
        AND r."startedAt" > COALESCE(
          (SELECT "restoredAt" FROM "RetentionSurveyRestore" WHERE "surveyId" = ${surveyId}),
          '-infinity'::timestamp
        )
    ) AS "byPolicy"
  `;
  if (!archived?.byPolicy) return { exemptionId: null };

  const now = await readDatabaseClock(tx);
  await tx.$executeRaw`
    INSERT INTO "RetentionSurveyRestore" ("surveyId", "restoredAt")
    VALUES (${surveyId}, ${now})
    ON CONFLICT ("surveyId")
    DO UPDATE SET "restoredAt" = GREATEST("RetentionSurveyRestore"."restoredAt", EXCLUDED."restoredAt")
  `;

  const [policy] = await tx.$queryRaw<{ periodDays: number }[]>`
    SELECT "periodDays"
    FROM "RetentionPolicy"
    WHERE "organizationId" = ${organizationId} AND "entity" = 'surveys' AND "enabled"
      AND "conditions" = ARRAY['createdBefore']::"RetentionSurveyCondition"[]
    FOR SHARE
  `;
  if (!policy) return { exemptionId: null };

  // An ended, unrevoked exemption still holds the one-active-per-survey slot: close it first, as
  // `createRetentionExemption` does.
  await tx.$executeRaw`
    UPDATE "RetentionExemption"
    SET "revokedAt" = "until"
    WHERE "surveyId" = ${surveyId} AND "entity" = 'surveys'
      AND "revokedAt" IS NULL AND "until" <= ${now}
  `;
  const until = new Date(now.getTime() + policy.periodDays * MS_PER_DAY);
  const [created] = await tx.$queryRaw<{ id: string }[]>`
    INSERT INTO "RetentionExemption"
      ("id", "created_at", "organizationId", "entity", "surveyId", "until", "source", "createdById")
    VALUES
      (${createId()}, ${now}, ${organizationId}, 'surveys', ${surveyId}, ${until}, 'restore', ${restoredById})
    ON CONFLICT ("surveyId", "entity") WHERE "revokedAt" IS NULL DO NOTHING
    RETURNING "id"
  `;
  return { exemptionId: created?.id ?? null };
};
