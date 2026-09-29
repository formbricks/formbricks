import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";
import { runUntilExhausted } from "./utils";

const BATCH_SIZE = 5000;

/**
 * ENG-3282: seed `Survey.ownerId` from `createdBy`, once.
 *
 * Runs before the survey projection trigger exists (the migration after this one), so these writes
 * enqueue nothing. Batches go through the autocommit `prisma` handle rather than the runner's
 * transaction so each commits on its own and a large table never holds one long lock. Idempotent:
 * the predicate only matches rows still to do, so a rerun resumes and an empty database is a no-op.
 */
export const backfillSurveyOwner: MigrationScript = {
  type: "data",
  id: "pqgmcbm8az1vb2c3zz5ojrmp",
  name: "20260928120001_backfill_survey_owner",
  run: async ({ prisma }) => {
    const { rows } = await runUntilExhausted(
      () =>
        prisma.$executeRaw`
        UPDATE "Survey" SET "ownerId" = "createdBy"
        WHERE id IN (
          SELECT id FROM "Survey"
          WHERE "ownerId" IS NULL AND "createdBy" IS NOT NULL
          ORDER BY id
          LIMIT ${BATCH_SIZE}
        )
      `
    );

    const [remaining] = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*) AS count FROM "Survey" WHERE "ownerId" IS NULL AND "createdBy" IS NOT NULL
    `;
    if (remaining.count > 0n) {
      throw new Error(`Survey owner backfill left ${remaining.count.toString()} surveys without an owner`);
    }

    logger.info(`Survey owner backfill: ${rows.toString()} surveys updated`);
  },
};
