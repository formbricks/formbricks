import "server-only";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { readDatabaseClock } from "@/lib/utils/database-clock";

/**
 * The archive purge's entries in data retention History (ENG-3614): when the purge deletes a survey the
 * surveys policy archived, History records the deletion, so its trail doesn't stop at "archived".
 *
 * A survey counts as the policy's when History holds an `archived` row for it. A survey only ever
 * archived by hand has none and stays out of History, as before.
 *
 * Each organisation gets one run per purge, of kind `purge`, opened the first time one of its surveys is
 * about to go (in its own statement, so the deletes can refer to it), with one `deleted` row per survey
 * written in the delete's own transaction: a delete that rolls back records nothing. Runs that recorded
 * nothing (every delete refused, say) are removed when the purge closes them. Purge runs don't count as
 * the sweep having run: every query about the sweep reads `kind = 'sweep'`.
 *
 * Like the purge's exemption check (`getSurveyPurgeEligibleWhere`), this reads and writes the retention
 * tables whether or not the organisation still has the licence: History is the record of what happened.
 */
export const createRetentionPurgeHistory = () => {
  const runIds = new Map<string, string>();

  return {
    /** Whether the surveys policy archived this survey, so its deletion belongs in History. */
    async wasArchivedByPolicy(surveyId: string): Promise<boolean> {
      const [row] = await prisma.$queryRaw<{ archived: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM "RetentionRunItem" i
          JOIN "RetentionRun" r ON r."id" = i."runId"
          WHERE i."targetId" = ${surveyId} AND i."targetType" = 'survey' AND i."action" = 'archived'
            AND r."entity" = 'surveys'
        ) AS "archived"
      `;
      return row?.archived ?? false;
    },

    /** This purge's run for the organisation, opened on first use. */
    async runFor(organizationId: string): Promise<string> {
      const existing = runIds.get(organizationId);
      if (existing) return existing;
      const id = createId();
      const startedAt = await readDatabaseClock(prisma);
      await prisma.$executeRaw`
        INSERT INTO "RetentionRun" ("id", "organizationId", "entity", "kind", "startedAt")
        VALUES (${id}, ${organizationId}, 'surveys', 'purge', ${startedAt})
      `;
      runIds.set(organizationId, id);
      return id;
    },

    /** The survey's `deleted` row, inside its delete's transaction, after the delete. */
    async recordDeletion(tx: Prisma.TransactionClient, runId: string, surveyId: string): Promise<void> {
      await tx.$executeRaw`
        INSERT INTO "RetentionRunItem" ("id", "runId", "targetType", "targetId", "action")
        VALUES (${createId()}, ${runId}, 'survey', ${surveyId}, 'deleted')
      `;
    },

    /** Finish every run this purge opened: count what it recorded, and drop the ones that recorded none. */
    async close(): Promise<void> {
      for (const [organizationId, runId] of runIds) {
        try {
          const finishedAt = await readDatabaseClock(prisma);
          const [{ deleted }] = await prisma.$queryRaw<{ deleted: number }[]>`
            UPDATE "RetentionRun" r
            SET "finishedAt" = ${finishedAt},
                "deletedCount" = c."deleted",
                "hasChanges" = c."deleted" > 0
            FROM (SELECT count(*)::int AS "deleted" FROM "RetentionRunItem" WHERE "runId" = ${runId}) c
            WHERE r."id" = ${runId}
            RETURNING c."deleted" AS "deleted"
          `;
          if (deleted === 0) await prisma.retentionRun.delete({ where: { id: runId } });
        } catch (error) {
          // The deletions themselves are recorded; only the run's totals are missing.
          logger.error(
            { err: error, organizationId, runId },
            "Could not close the archive purge's History run"
          );
        }
      }
      runIds.clear();
    },
  };
};

export type TRetentionPurgeHistory = ReturnType<typeof createRetentionPurgeHistory>;
