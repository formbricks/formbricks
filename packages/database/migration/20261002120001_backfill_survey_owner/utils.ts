/**
 * Runs `runBatch` until it reports zero affected rows. Each call is expected to update at most one
 * batch and commit on its own, so progress survives an interrupted run and a rerun resumes where the
 * previous one stopped.
 *
 * `maxBatches` is a runaway guard, not a size limit: a batch that keeps reporting rows without making
 * progress (a predicate its own UPDATE does not falsify) would otherwise loop forever.
 */
export const runUntilExhausted = async (
  runBatch: () => Promise<number>,
  { maxBatches = 1_000_000 }: { maxBatches?: number } = {}
): Promise<{ batches: number; rows: number }> => {
  let batches = 0;
  let rows = 0;

  while (batches < maxBatches) {
    const affected = await runBatch();
    if (affected === 0) return { batches, rows };
    batches += 1;
    rows += affected;
  }

  throw new Error(
    `Backfill did not converge after ${maxBatches.toString()} batches (${rows.toString()} rows)`
  );
};
