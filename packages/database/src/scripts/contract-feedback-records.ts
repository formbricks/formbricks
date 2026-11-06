import { logger } from "@formbricks/logger";
import type { PrismaClient } from "../prisma";

/** NPS answers in the contract fixture dataset, by source: [sourceName, scores]. */
export const CONTRACT_FEEDBACK_RECORDS = [
  ["Contract fixture — web", [10, 9, 6]],
  ["Contract fixture — email", [8, 3, 10]],
] as const;

type TRawQueryClient = Pick<PrismaClient, "$queryRaw" | "$executeRaw">;

/**
 * Rows for Cube to answer the v3 chart query operations from in the contract job, so they validate real
 * data rows instead of an empty result. `feedback_records` belongs to the Hub, not Prisma: it exists only
 * once the Hub schema is applied (scripts/start-cube-ci.sh does that in CI). Without it this writes
 * nothing and returns null. Collected a day or two ago, inside the "last 7 days" range the spec's
 * examples ask for, and re-dated on every run. Returns the number of rows written.
 */
export async function seedContractFeedbackRecords(
  prisma: TRawQueryClient,
  datasetId: string
): Promise<number | null> {
  const [{ present }] = await prisma.$queryRaw<{ present: boolean }[]>`
    SELECT to_regclass('public.feedback_records') IS NOT NULL AS present`;
  if (!present) {
    logger.info("No feedback_records table (Hub schema not applied) — skipping the Cube fixture rows.");
    return null;
  }

  let written = 0;
  for (const [sourceName, scores] of CONTRACT_FEEDBACK_RECORDS) {
    for (const [index, score] of scores.entries()) {
      const submissionId = `contract-${sourceName.split(" — ")[1]}-${index}`;
      await prisma.$executeRaw`
        INSERT INTO feedback_records
          (tenant_id, submission_id, field_id, field_type, source_type, source_name, value_number, collected_at)
        VALUES
          (${datasetId}, ${submissionId}, 'contract-nps', 'nps', 'formbricks', ${sourceName},
           ${score}, now() - make_interval(hours => ${24 + index}))
        ON CONFLICT (tenant_id, submission_id, field_id)
        DO UPDATE SET value_number = EXCLUDED.value_number, source_name = EXCLUDED.source_name,
          collected_at = EXCLUDED.collected_at`;
      written++;
    }
  }
  return written;
}
