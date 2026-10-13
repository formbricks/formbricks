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
 * and the run's count written in the delete's own transaction: a delete that rolls back records nothing. Runs that recorded
 * nothing (every delete refused, say) are removed when the purge closes them. Purge runs don't count as
 * the sweep having run: every query about the sweep reads `kind = 'sweep'`.
 *
 * Like the purge's exemption check (`getSurveyPurgeEligibleWhere`), this reads and writes the retention
 * tables whether or not the organisation still has the licence: History is the record of what happened.
 */
export const createRetentionPurgeHistory = () => {
  const runIds = new Map<string, string>();

  return {
    /** Which of these surveys the surveys policy archived, so their deletion belongs in History. */
    async archivedByPolicy(surveyIds: readonly string[]): Promise<Set<string>> {
      if (surveyIds.length === 0) return new Set();
      const rows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT i."targetId" AS "id"
        FROM "RetentionRunItem" i
        JOIN "RetentionRun" r ON r."id" = i."runId"
        WHERE i."targetId" = ANY(${surveyIds}::text[]) AND i."targetType" = 'survey'
          AND i."action" = 'archived' AND r."entity" = 'surveys'
      `;
      return new Set(rows.map((row) => row.id));
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

    /**
     * The survey's `deleted` row, inside its delete's transaction, after the delete, with the run's count
     * moved with it: a purge that dies before `close` still shows its deletions in History.
     */
    async recordDeletion(tx: Prisma.TransactionClient, runId: string, surveyId: string): Promise<void> {
      await tx.$executeRaw`
        INSERT INTO "RetentionRunItem" ("id", "runId", "targetType", "targetId", "action")
        VALUES (${createId()}, ${runId}, 'survey', ${surveyId}, 'deleted')
      `;
      await tx.$executeRaw`
        UPDATE "RetentionRun" SET "deletedCount" = "deletedCount" + 1, "hasChanges" = true
        WHERE "id" = ${runId}
      `;
    },

    /** Finish every run this purge opened, and drop the ones that recorded nothing. */
    async close(): Promise<void> {
      for (const [organizationId, runId] of runIds) {
        try {
          const finishedAt = await readDatabaseClock(prisma);
          const { deletedCount } = await prisma.retentionRun.update({
            where: { id: runId },
            data: { finishedAt },
            select: { deletedCount: true },
          });
          if (deletedCount === 0) await prisma.retentionRun.delete({ where: { id: runId } });
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
